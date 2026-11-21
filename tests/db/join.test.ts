import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, type Actor } from "@/lib/access";
import { InputError } from "@/lib/errors";
import { createGyfteGroup, createSampleFamily, groupPage, setFamilyLink } from "@/lib/gyfte/groups";
import { approveJoinRequest, declineJoinRequest, JOIN_LIMIT, joinRequests, requestToJoin } from "@/lib/gyfte/join";
import { pool } from "@/lib/db";

let hudson: Actor, otherAdmin: Actor, member: Actor;
let groupId: string, accessGroupId: string, token: string;

const members = async () =>
  (await admin.query<{ email: string }>(
    `select u.email from group_members m join "user" u on u.id = m.user_id where m.group_id = $1 order by u.email`,
    [accessGroupId],
  )).rows.map((r) => r.email);

describeDb("asking to join from a family link", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    otherAdmin = await makeUser({ isAdmin: true });
    member = await makeUser();
    groupId = await createGyfteGroup(hudson, "Ford Family");
    accessGroupId = (await groupPage(hudson, groupId)).accessGroupId;
    token = (await setFamilyLink(hudson, groupId, true))!;
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("takes a name and email, and only with a working link", async () => {
    await expect(requestToJoin("A".repeat(32), { name: "Avery", email: "avery@example.test" })).rejects.toBeInstanceOf(InputError);
    await expect(requestToJoin(token, { name: " ", email: "avery@example.test" })).rejects.toBeInstanceOf(InputError);
    await expect(requestToJoin(token, { name: "Avery", email: "not-an-email" })).rejects.toBeInstanceOf(InputError);

    await requestToJoin(token, { name: "  Avery   Ford ", email: " Avery@Example.test " });
    expect((await joinRequests(hudson, groupId)).map((r) => [r.name, r.email])).toEqual([["Avery Ford", "avery@example.test"]]);

    // Turned off, the link takes no more requests.
    await setFamilyLink(hudson, groupId, false);
    await expect(requestToJoin(token, { name: "Sam", email: "sam@example.test" })).rejects.toBeInstanceOf(InputError);
  });

  it("gives the same reply for existing accounts and repeats, keeping one request per email", async () => {
    const existing = (await admin.query<{ email: string }>(`select email from "user" where id = $1`, [member.id])).rows[0].email;
    await expect(requestToJoin(token, { name: "Me", email: existing })).resolves.toBeUndefined();
    await expect(requestToJoin(token, { name: "Me again", email: existing })).resolves.toBeUndefined();
    const reqs = await joinRequests(hudson, groupId);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].name).toBe("Me again");
  });

  it("limits how many requests a group takes in an hour", async () => {
    for (let i = 0; i < JOIN_LIMIT.perGroupPerHour; i++) {
      await requestToJoin(token, { name: `P${i}`, email: `p${i}@example.test` });
    }
    await expect(requestToJoin(token, { name: "One more", email: "more@example.test" })).rejects.toBeInstanceOf(InputError);
  });

  it("never takes requests for a sample family", async () => {
    const sample = await createSampleFamily(hudson);
    const { rows } = await admin.query<{ invite_token: string | null }>("select invite_token from gyfte_groups where id = $1", [sample]);
    expect(rows[0].invite_token).toBeNull();
  });

  it("shows requests only to admins in the group", async () => {
    await requestToJoin(token, { name: "Avery", email: "avery@example.test" });
    await expect(joinRequests(member, groupId)).rejects.toBeInstanceOf(AccessDenied);
    expect(await joinRequests(otherAdmin, groupId)).toEqual([]); // admin, but not in this group
  });

  it("approving adds them to warbag and the group; only an admin in the group can", async () => {
    await requestToJoin(token, { name: "Avery", email: "avery@example.test" });
    const [req] = await joinRequests(hudson, groupId);
    await expect(approveJoinRequest(member, req.id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(approveJoinRequest(otherAdmin, req.id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(approveJoinRequest(hudson, "not-a-uuid")).rejects.toBeInstanceOf(AccessDenied);

    expect(await approveJoinRequest(hudson, req.id)).toEqual({ name: "Avery" });
    expect(await members()).toContain("avery@example.test");
    expect(await joinRequests(hudson, groupId)).toEqual([]);
    const { rows } = await admin.query(`select action from audit_events where actor_id = $1 and action like 'gyfte.join.%'`, [hudson.id]);
    expect(rows.map((r) => r.action)).toEqual(["gyfte.join.approve"]);

    // Asking again later with an existing account adds the same account, not a new one.
    await requestToJoin(token, { name: "Avery F", email: "avery@example.test" });
    const [again] = await joinRequests(hudson, groupId);
    await approveJoinRequest(hudson, again.id);
    const count = await admin.query(`select count(*)::int as n from "user" where email = 'avery@example.test'`);
    expect(count.rows[0].n).toBe(1);
  });

  it("declining deletes the request and adds no one", async () => {
    await requestToJoin(token, { name: "Stranger", email: "stranger@example.test" });
    const [req] = await joinRequests(hudson, groupId);
    await expect(declineJoinRequest(member, req.id)).rejects.toBeInstanceOf(AccessDenied);
    await declineJoinRequest(hudson, req.id);
    expect(await joinRequests(hudson, groupId)).toEqual([]);
    expect(await members()).not.toContain("stranger@example.test");
    const u = await admin.query(`select 1 from "user" where email = 'stranger@example.test'`);
    expect(u.rowCount).toBe(0);
  });
});
