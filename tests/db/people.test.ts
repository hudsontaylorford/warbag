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
  newGroup,
  setPeopleManager,
  setAdmin,
  removalImpact,
} from "@/lib/people";
import { deleteGroup } from "@/lib/access";
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

  it("admins make and remove admins, with safeguards", async () => {
    const isAdmin = async (id: string) => (await admin.query(`select "isAdmin", "isPeopleManager" from "user" where id = $1`, [id])).rows[0];
    // Molly is a people manager first: becoming an admin replaces that.
    await setPeopleManager(hudson, molly.id, true);
    const pm: Actor = { id: molly.id, isAdmin: false, peopleManager: true };
    // Only admins, never people managers, never on themselves.
    await expect(setAdmin(pm, molly.id, true)).rejects.toBeInstanceOf(AccessDenied);
    await expect(setAdmin(pm, hudson.id, false)).rejects.toBeInstanceOf(AccessDenied);
    await expect(setAdmin(hudson, hudson.id, false)).rejects.toBeInstanceOf(InputError);

    await setAdmin(hudson, molly.id, true);
    expect(await isAdmin(molly.id)).toEqual({ isAdmin: true, isPeopleManager: false });
    const mollyAdmin: Actor = { id: molly.id, isAdmin: true };
    expect((await listPeople(mollyAdmin)).length).toBeGreaterThan(1);
    const log = await admin.query(`select action from audit_events where actor_id = $1 and target = $2 order by created_at`, [hudson.id, `user/${molly.id}`]);
    expect(log.rows.map((r) => r.action)).toContain("person.admin.on");

    // Doing it twice changes nothing; another admin can undo it.
    await setAdmin(hudson, molly.id, true);
    await setAdmin(mollyAdmin, hudson.id, false);
    expect((await isAdmin(hudson.id)).isAdmin).toBe(false);
    await setAdmin(mollyAdmin, hudson.id, true);
    await setAdmin(hudson, molly.id, false);
    expect((await isAdmin(molly.id)).isAdmin).toBe(false);

    // Never a made-up sample person or a trip guest; an unknown person says so.
    const sample = await makeUser();
    await admin.query(`update "user" set email = $2 where id = $1`, [sample.id, `${sample.id}@sample.invalid`]);
    await expect(setAdmin(hudson, sample.id, true)).rejects.toBeInstanceOf(InputError);
    const guest = await makeUser();
    await admin.query(`update "user" set "isGuest" = true where id = $1`, [guest.id]);
    await expect(setAdmin(hudson, guest.id, true)).rejects.toBeInstanceOf(InputError);
    await expect(setAdmin(hudson, crypto.randomUUID(), true)).rejects.toBeInstanceOf(InputError);
  });

  it("people managers invite and manage groups and apps, but never their own access or an admin's", async () => {
    const agentUser = await makeUser();
    await setPeopleManager(hudson, agentUser.id, true);
    expect((await getPerson(hudson, agentUser.id))!.peopleManager).toBe(true);
    const agent: Actor = { id: agentUser.id, isAdmin: false, peopleManager: true };
    const aunt = await makeUser();

    // What they can do.
    expect((await listPeople(agent)).length).toBeGreaterThan(2);
    const { id: cousin } = await invitePerson(agent, { email: "cousin@example.test", sendEmail: false });
    await renamePerson(agent, cousin, "Cousin");
    const g = await newGroup(agent, "Cousins");
    await setGroupMembers(agent, g, [cousin, aunt.id]);
    await setGroupApps(agent, g, ["gyfte"]);
    await setPersonApps(agent, aunt.id, ["mosey"]);
    await setPersonGroups(agent, molly.id, [g]);
    await renameGroup(agent, g, "Cousins and aunts");
    expect((await getGroup(agent, g))!.memberIds.sort()).toEqual([cousin, aunt.id, molly.id].sort());
    expect(await canUseApp(aunt, "mosey")).toBe(true);
    await renamePerson(agent, agent.id, "Assistant"); // its own name is fine

    // Never its own access.
    await expect(setPersonApps(agent, agent.id, ["mosey"])).rejects.toBeInstanceOf(AccessDenied);
    await expect(setPersonGroups(agent, agent.id, [g])).rejects.toBeInstanceOf(AccessDenied);
    await expect(setGroupMembers(agent, g, [cousin, aunt.id, molly.id, agent.id])).rejects.toBeInstanceOf(AccessDenied);
    await setGroupMembers(hudson, g, [cousin, agent.id]); // an admin puts it in a group
    await expect(setGroupApps(agent, g, ["gyfte", "mosey"])).rejects.toBeInstanceOf(AccessDenied);

    // Never an admin.
    await expect(renamePerson(agent, hudson.id, "Not Hudson")).rejects.toBeInstanceOf(AccessDenied);
    await expect(setPersonApps(agent, hudson.id, [])).rejects.toBeInstanceOf(AccessDenied);
    await expect(setPersonGroups(agent, hudson.id, [g])).rejects.toBeInstanceOf(AccessDenied);
    const family = await createGroup(hudson, "Family");
    await setGroupMembers(hudson, family, [hudson.id, molly.id]);
    await expect(setGroupMembers(agent, family, [molly.id])).rejects.toBeInstanceOf(AccessDenied); // removing Hudson

    // Admin-only stays admin-only.
    await expect(removePerson(agent, molly.id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(removalImpact(agent, molly.id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(deleteGroup(agent, g)).rejects.toBeInstanceOf(AccessDenied);
    await expect(setPeopleManager(agent, molly.id, true)).rejects.toBeInstanceOf(AccessDenied);
    await expect(setPeopleManager(hudson, hudson.id, true)).rejects.toBeInstanceOf(InputError);

    // Turned off, nothing works anymore.
    await setPeopleManager(hudson, agentUser.id, false);
    await expect(listPeople({ id: agentUser.id, isAdmin: false })).rejects.toBeInstanceOf(AccessDenied);
  });
});
