import { afterAll, beforeEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, addToGroup, type Actor } from "@/lib/access";
import { addItem, createList, InputError, setReceived } from "@/lib/gyfte/data";
import { claimItem } from "@/lib/gyfte/claims";
import { setMyName } from "@/lib/account";
import {
  addListToGroup,
  createGyfteGroup,
  createSampleFamily,
  familyLink,
  groupPage,
  memberGroupIdForLink,
  publicGroupList,
  publicGroupPage,
  returnPath,
  sendThisIsMe,
  setFamilyLink,
  startMyGroupList,
} from "@/lib/gyfte/groups";
import { pool } from "@/lib/db";

const outbox = path.join(mkdtempSync(path.join(tmpdir(), "warbag-")), "outbox.jsonl");
process.env.EMAIL_OUTBOX_FILE = outbox;
process.env.BETTER_AUTH_URL = "http://localhost:3000";
const sent = (to: string) =>
  existsSync(outbox) ? readFileSync(outbox, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((m) => m.to === to) : [];
const headers = () => new Headers({ host: "localhost:3000", origin: "http://localhost:3000" });

let hudson: Actor, molly: Actor, aunt: Actor;
const email = async (id: string) => (await admin.query(`select email from "user" where id = $1`, [id])).rows[0].email;

describeDb("family links and This is me", () => {
  let groupId: string;
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    molly = await makeUser();
    aunt = await makeUser();
    groupId = await createGyfteGroup(hudson, "Ford Family");
    const page = await groupPage(hudson, groupId);
    await addToGroup(hudson, page.accessGroupId, molly.id);
    await addToGroup(hudson, page.accessGroupId, aunt.id);
    await setMyName(molly, "Molly");
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("is made, replaced and turned off by an admin in the group, never for samples", async () => {
    await expect(setFamilyLink(molly, groupId, true)).rejects.toBeInstanceOf(AccessDenied);
    const first = await setFamilyLink(hudson, groupId, true);
    expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await familyLink(hudson, groupId)).toBe(first);

    const second = await setFamilyLink(hudson, groupId, true);
    expect(await publicGroupPage(first!)).toBeNull();
    expect(await publicGroupPage(second!)).not.toBeNull();

    await setFamilyLink(hudson, groupId, false);
    expect(await publicGroupPage(second!)).toBeNull();

    const sample = await createSampleFamily(hudson);
    await expect(setFamilyLink(hudson, sample, true)).rejects.toBeInstanceOf(InputError);
  });

  it("shows visitors names and wanted gifts, never claims or received gifts", async () => {
    const token = (await setFamilyLink(hudson, groupId, true))!;
    const list = await startMyGroupList(molly, groupId, (await groupPage(molly, groupId)).year);
    const scarf = await addItem(molly, list, "Wool scarf");
    const got = await addItem(molly, list, "Old mug");
    await setReceived(molly, got, true);
    await claimItem(aunt, scarf);

    const page = (await publicGroupPage(token))!;
    expect(page.christmas.find((r) => r.name === "Molly")?.list?.gifts).toBe(1);
    expect(page.samplePeople).toEqual([]);
    const view = (await publicGroupList(token, list))!;
    expect(view.gifts.map((g) => g.name)).toEqual(["Wool scarf"]);
    expect(JSON.stringify({ page, view })).not.toMatch(/claim/i);
  });

  it("only opens lists filed in that group", async () => {
    const token = (await setFamilyLink(hudson, groupId, true))!;
    const elsewhere = await createList(hudson, { forMe: true, recipientName: "H", occasion: "christmas", date: "" });
    expect(await publicGroupList(token, elsewhere)).toBeNull();
    await addListToGroup(hudson, elsewhere, groupId);
    expect(await publicGroupList(token, elsewhere)).not.toBeNull();
    expect(await publicGroupList("A".repeat(32), elsewhere)).toBeNull();
  });

  it("sends a sign-in link only to the person picked, and only if they're in the group", async () => {
    const token = (await setFamilyLink(hudson, groupId, true))!;
    const outsider = await makeUser();
    await expect(sendThisIsMe(token, outsider.id, headers())).rejects.toBeInstanceOf(InputError);
    await expect(sendThisIsMe("A".repeat(32), molly.id, headers())).rejects.toBeInstanceOf(InputError);

    expect(await sendThisIsMe(token, molly.id, headers())).toEqual({ name: "Molly" });
    const [mail] = sent(await email(molly.id));
    expect(mail.subject).toBe("Your sign-in link for Ford Family");
    expect(mail.text).toMatch(new RegExp(`/api/auth/magic-link/verify\\?token=[^\\s]+callbackURL=%2Fgyfte%2Fgroups%2F${groupId}`));
    expect(sent(await email(aunt.id))).toEqual([]);
  });

  it("returns a sign-in to the list they opened, only if it's in that group", async () => {
    const token = (await setFamilyLink(hudson, groupId, true))!;
    const inGroup = await createList(hudson, { forMe: true, recipientName: "H", occasion: "christmas", date: "" });
    await addListToGroup(hudson, inGroup, groupId);
    const elsewhere = await createList(hudson, { forMe: false, recipientName: "X", occasion: "christmas", date: "" });

    expect(await returnPath(groupId, inGroup)).toBe(`/gyfte/${inGroup}`);
    for (const bad of [elsewhere, "//evil.example", "https://evil.example", "../admin", "", null, undefined]) {
      expect(await returnPath(groupId, bad)).toBe(`/gyfte/groups/${groupId}`);
    }

    await sendThisIsMe(token, molly.id, headers(), inGroup);
    const [mail] = sent(await email(molly.id));
    expect(mail.text).toMatch(new RegExp(`callbackURL=%2Fgyfte%2F${inGroup}`));
  });

  it("limits repeat sends for one person", async () => {
    const token = (await setFamilyLink(hudson, groupId, true))!;
    for (let i = 0; i < 3; i++) await sendThisIsMe(token, aunt.id, headers());
    await expect(sendThisIsMe(token, aunt.id, headers())).rejects.toBeInstanceOf(InputError);
    await sendThisIsMe(token, molly.id, headers()); // others aren't blocked
  });

  it("sends members who open the link to the real group page", async () => {
    const token = (await setFamilyLink(hudson, groupId, true))!;
    expect(await memberGroupIdForLink(molly, token)).toBe(groupId);
    expect(await memberGroupIdForLink(await makeUser(), token)).toBeNull();
  });
});
