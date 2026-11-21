import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, canUseApp, createGroup, type Actor } from "@/lib/access";
import {
  getGroup,
  getPerson,
  InputError,
  invitePerson,
  listGroups,
  listPeople,
  normalizeEmail,
  removePerson,
  renameGroup,
  renamePerson,
  setGroupApps,
  setGroupMembers,
  setPersonApps,
  setPersonGroups,
} from "@/lib/people";
import { pool } from "@/lib/db";

let hudson: Actor, molly: Actor;

describeDb("people and groups (admin)", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    molly = await makeUser();
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("refuses every admin function to non-admins", async () => {
    const g = await createGroup(hudson, "Family");
    const calls: (() => Promise<unknown>)[] = [
      () => listPeople(molly),
      () => getPerson(molly, hudson.id),
      () => invitePerson(molly, { email: "x@example.test", sendEmail: false }),
      () => renamePerson(molly, hudson.id, "x"),
      () => removePerson(molly, hudson.id),
      () => setPersonApps(molly, molly.id, ["gyfte"]),
      () => setPersonGroups(molly, molly.id, [g]),
      () => listGroups(molly),
      () => getGroup(molly, g),
      () => renameGroup(molly, g, "x"),
      () => setGroupMembers(molly, g, [molly.id]),
      () => setGroupApps(molly, g, ["gyfte"]),
    ];
    for (const call of calls) await expect(call()).rejects.toBeInstanceOf(AccessDenied);
  });

  it("invites by email once, normalizing the address", async () => {
    const first = await invitePerson(hudson, { email: "  New.Person@Example.TEST ", name: "New", sendEmail: false });
    expect(first).toMatchObject({ created: true, emailed: false });
    const again = await invitePerson(hudson, { email: "new.person@example.test", sendEmail: false });
    expect(again).toMatchObject({ id: first.id, created: false });

    const person = await getPerson(hudson, first.id);
    expect(person).toMatchObject({ email: "new.person@example.test", name: "New", isAdmin: false, apps: [], groupIds: [] });
  });

  it("gives an invited person no apps until they're given some", async () => {
    const { id } = await invitePerson(hudson, { email: "fresh@example.test", sendEmail: false });
    expect(await canUseApp({ id, isAdmin: false }, "gyfte")).toBe(false);
  });

  it("rejects bad emails and names", async () => {
    expect(() => normalizeEmail("not an email")).toThrow(InputError);
    await expect(invitePerson(hudson, { email: "a@b.co", name: "x".repeat(81), sendEmail: false })).rejects.toBeInstanceOf(InputError);
  });

  it("sets exactly the apps given to a person", async () => {
    await setPersonApps(hudson, molly.id, ["gyfte", "chirk"]);
    expect((await getPerson(hudson, molly.id))!.apps.sort()).toEqual(["chirk", "gyfte"]);
    await setPersonApps(hudson, molly.id, ["chirk"]);
    expect((await getPerson(hudson, molly.id))!.apps).toEqual(["chirk"]);
    expect(await canUseApp(molly, "gyfte")).toBe(false);
    await expect(setPersonApps(hudson, molly.id, ["not-an-app"])).rejects.toBeInstanceOf(InputError);
  });

  it("sets exactly a person's groups, and a group's members and apps", async () => {
    const family = await createGroup(hudson, "Family");
    const friends = await createGroup(hudson, "Friends");

    await setPersonGroups(hudson, molly.id, [family, friends]);
    expect((await getPerson(hudson, molly.id))!.groupIds.sort()).toEqual([family, friends].sort());

    await setGroupMembers(hudson, family, [hudson.id]);
    expect((await getGroup(hudson, family))!.memberIds).toEqual([hudson.id]);

    await setGroupApps(hudson, friends, ["gyfte"]);
    expect(await canUseApp(molly, "gyfte")).toBe(true);
    await setPersonGroups(hudson, molly.id, []);
    expect(await canUseApp(molly, "gyfte")).toBe(false);
  });

  it("renames people and groups", async () => {
    await renamePerson(hudson, molly.id, "  Molly  ");
    expect((await getPerson(hudson, molly.id))!.name).toBe("Molly");
    const g = await createGroup(hudson, "Fam");
    await renameGroup(hudson, g, "Family");
    expect((await getGroup(hudson, g))!.name).toBe("Family");
    await expect(renameGroup(hudson, g, "  ")).rejects.toBeInstanceOf(InputError);
  });

  it("removes a person and everything that gave them access, but never yourself", async () => {
    const family = await createGroup(hudson, "Family");
    await setPersonGroups(hudson, molly.id, [family]);
    await setPersonApps(hudson, molly.id, ["gyfte"]);

    await removePerson(hudson, molly.id);
    expect(await getPerson(hudson, molly.id)).toBeNull();
    expect((await getGroup(hudson, family))!.memberIds).toEqual([]);
    const { rowCount } = await admin.query("select 1 from app_grants where user_id = $1", [molly.id]);
    expect(rowCount).toBe(0);

    await expect(removePerson(hudson, hudson.id)).rejects.toBeInstanceOf(InputError);
  });

  it("lists people with their groups", async () => {
    const family = await createGroup(hudson, "Family");
    await setPersonGroups(hudson, molly.id, [family]);
    const row = (await listPeople(hudson)).find((p) => p.id === molly.id);
    expect(row).toMatchObject({ groups: ["Family"], lastSignIn: null });
  });

  it("treats a malformed group id as not found", async () => {
    expect(await getGroup(hudson, "nope")).toBeNull();
    await expect(setPersonGroups(hudson, molly.id, ["nope"])).rejects.toBeInstanceOf(InputError);
  });
});
