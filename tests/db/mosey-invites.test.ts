import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, grantApp, type Actor } from "@/lib/access";
import { InputError } from "@/lib/errors";
import { createTrip, createTripLink, getTrip, revokeTripLink, setTripOrganizers, tripSharing } from "@/lib/mosey/trips";
import { approveTripJoin, declineTripJoin, inviteToTrip, requestToJoinTrip, TRIP_JOIN_LIMIT, tripJoinRequests } from "@/lib/mosey/invites";
import { pool } from "@/lib/db";

// Made-up people only.
let hudson: Actor, helper: Actor, outsider: Actor;
let tripId: string;
const maine = { name: "Maine", start: "2027-06-05", end: "2027-06-08" };
const userByEmail = async (email: string) => (await admin.query(`select id from "user" where email = $1`, [email])).rows[0]?.id as string | undefined;

describeDb("Mosey: getting people into a trip", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    helper = await makeUser();
    outsider = await makeUser();
    tripId = await createTrip(hudson, maine);
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("invite by email: on warbag and on the trip in one step, as member or co-organizer", async () => {
    const email = `${crypto.randomUUID()}@example.test`;
    await inviteToTrip(hudson, tripId, { name: "Cousin", email: email.toUpperCase(), role: "contribute", sendEmail: false });
    const cousin = await userByEmail(email);
    expect(cousin).toBeTruthy();
    const seen = await getTrip({ id: cousin!, isAdmin: false }, tripId);
    expect([seen.role, seen.organizer]).toEqual(["contribute", false]);

    const email2 = `${crypto.randomUUID()}@example.test`;
    await inviteToTrip(hudson, tripId, { name: "Co", email: email2, role: "manage", sendEmail: true });
    expect((await getTrip({ id: (await userByEmail(email2))!, isAdmin: false }, tripId)).organizer).toBe(true);
    // A member invite never downgrades a co-organizer.
    await inviteToTrip(hudson, tripId, { name: "Co", email: email2, role: "contribute", sendEmail: false });
    expect((await tripSharing(hudson, tripId)).organizers).toHaveLength(1);

    await expect(inviteToTrip(hudson, tripId, { name: "", email: "x@example.test", role: "contribute", sendEmail: false })).rejects.toBeInstanceOf(InputError);
    await expect(inviteToTrip(hudson, tripId, { name: "X", email: "not an email", role: "contribute", sendEmail: false })).rejects.toBeInstanceOf(InputError);
  });

  it("only the trip's owner invites, and only if they can add people to warbag", async () => {
    await setTripOrganizers(hudson, tripId, [helper.id]);
    const input = { name: "X", email: `${crypto.randomUUID()}@example.test`, role: "contribute", sendEmail: false };
    await expect(inviteToTrip(helper, tripId, input)).rejects.toBeInstanceOf(AccessDenied); // co-organizer
    await expect(inviteToTrip(outsider, tripId, input)).rejects.toBeInstanceOf(AccessDenied);
    // An owner who isn't an admin or people manager can't add new people to warbag.
    await grantApp(hudson, "mosey", { userId: outsider.id });
    const theirs = await createTrip(outsider, maine);
    await expect(inviteToTrip(outsider, theirs, input)).rejects.toBeInstanceOf(AccessDenied);
    expect(await userByEmail(input.email)).toBeUndefined();
  });

  it("ask to join from the trip link: nothing happens until the owner adds them", async () => {
    await createTripLink(hudson, tripId);
    const [link] = (await tripSharing(hudson, tripId)).links;
    const email = `${crypto.randomUUID()}@example.test`;
    await requestToJoinTrip(link.token, { name: "Aunt", email });
    await requestToJoinTrip(link.token, { name: "Aunt May", email }); // again: refreshes the name
    expect(await userByEmail(email)).toBeUndefined();
    const reqs = await tripJoinRequests(hudson, tripId);
    expect(reqs.map((r) => [r.name, r.email])).toEqual([["Aunt May", email]]);

    // Only the owner sees and answers requests.
    await setTripOrganizers(hudson, tripId, [helper.id]);
    await expect(tripJoinRequests(helper, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(approveTripJoin(helper, reqs[0].id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(approveTripJoin(outsider, reqs[0].id)).rejects.toBeInstanceOf(AccessDenied);

    await approveTripJoin(hudson, reqs[0].id);
    const aunt = await userByEmail(email);
    expect((await getTrip({ id: aunt!, isAdmin: false }, tripId)).role).toBe("contribute");
    expect(await tripJoinRequests(hudson, tripId)).toEqual([]);

    const other = `${crypto.randomUUID()}@example.test`;
    await requestToJoinTrip(link.token, { name: "Stranger", email: other });
    await declineTripJoin(hudson, (await tripJoinRequests(hudson, tripId))[0].id);
    expect(await tripJoinRequests(hudson, tripId)).toEqual([]);
    expect(await userByEmail(other)).toBeUndefined();
  });

  it("a turned-off or made-up link can't be used to ask, and asks are limited", async () => {
    await createTripLink(hudson, tripId);
    const [link] = (await tripSharing(hudson, tripId)).links;
    await expect(requestToJoinTrip("x".repeat(32), { name: "A", email: "a@example.test" })).rejects.toThrow(/isn't working/);
    for (let i = 0; i < TRIP_JOIN_LIMIT.perTripPerHour; i++) await requestToJoinTrip(link.token, { name: "A", email: `a${i}@example.test` });
    await expect(requestToJoinTrip(link.token, { name: "B", email: "b@example.test" })).rejects.toThrow(/Try again in an hour/);
    await revokeTripLink(hudson, tripId, link.id);
    await expect(requestToJoinTrip(link.token, { name: "C", email: "c@example.test" })).rejects.toThrow(/isn't working/);
  });
});
