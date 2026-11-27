import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, grantApp, type Actor } from "@/lib/access";
import { InputError } from "@/lib/errors";
import {
  addStop,
  createTrip,
  createTripLink,
  getTrip,
  planStop,
  replaceTripLink,
  setAttendance,
  setTripMembers,
  setTripOrganizers,
  tripByLink,
  tripSharing,
} from "@/lib/mosey/trips";
import { addExpense, addPerson, ledger } from "@/lib/mosey/ledger";
import { joinableNames, joinByLink, myGuestLink, openGuestLink, setLinkOptions, turnOffJoiner } from "@/lib/mosey/link-join";
import { discardReceipt, openReceipt, receiptsByExpense, unsavedReceipts, uploadReceipt } from "@/lib/mosey/receipts";
import { pool } from "@/lib/db";

let owner: Actor, coorg: Actor, member: Actor, outsider: Actor;
let tripId: string;
let token: string;
let ann: string, ben: string, kid: string;

const maine = { name: "Maine", place: "Bar Harbor", start: "2027-06-05", end: "2027-06-08" };
const guest = (id: string): Actor => ({ id, isAdmin: false, guest: true });

async function joinAs(name: string) {
  const people = await joinableNames(token);
  const p = people.find((n) => n.name === name);
  const r = await joinByLink(null, token, p ? { personId: p.id } : { name });
  expect(r.newGuestId).toBeTruthy();
  return guest(r.newGuestId!);
}

describeDb("Mosey: joining from the trip link", () => {
  beforeEach(async () => {
    owner = await makeUser({ isAdmin: true });
    coorg = await makeUser();
    member = await makeUser();
    outsider = await makeUser();
    await grantApp(owner, "mosey", { userId: owner.id });
    tripId = await createTrip(owner, maine);
    await setTripMembers(owner, tripId, { groupIds: [], userIds: [member.id] });
    await setTripOrganizers(owner, tripId, [coorg.id]);
    await createTripLink(owner, tripId);
    token = (await tripSharing(owner, tripId)).links[0].token;
    ann = await addPerson(owner, tripId, { name: "Ann", household: "Ann & Ben" });
    ben = await addPerson(owner, tripId, { name: "Ben", household: "Ann & Ben" });
    kid = await addPerson(owner, tripId, { name: "Kit", household: "Ann & Ben", kid: true });
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("is off until the owner turns it on; only the owner can", async () => {
    expect(await joinableNames(token)).toEqual([]);
    await expect(joinByLink(null, token, { personId: ann })).rejects.toBeInstanceOf(InputError);
    expect((await tripByLink(token))!.linkJoin).toBe(false);

    await expect(setLinkOptions(coorg, tripId, { join: true, money: false })).rejects.toBeInstanceOf(AccessDenied);
    await expect(setLinkOptions(member, tripId, { join: true, money: false })).rejects.toBeInstanceOf(AccessDenied);
    await setLinkOptions(owner, tripId, { join: true, money: false });
    expect((await tripByLink(token))!.linkJoin).toBe(true);
    // Adults nobody has picked; never kids.
    expect((await joinableNames(token)).map((n) => n.name)).toEqual(["Ann", "Ben"]);
    await expect(joinByLink(null, "x".repeat(32), { personId: ann })).rejects.toBeInstanceOf(InputError);
  });

  it("signed out: picking a name makes a guest who is a member of this trip only", async () => {
    await setLinkOptions(owner, tripId, { join: true, money: false });
    const g = await joinAs("Ann");

    const row = await admin.query(`select name, email, "isGuest", "emailVerified" from "user" where id = $1`, [g.id]);
    expect(row.rows[0]).toMatchObject({ name: "Ann", isGuest: true, emailVerified: false });
    expect(row.rows[0].email).toMatch(/@guest\.invalid$/);

    const trip = await getTrip(g, tripId);
    expect(trip.role).toBe("contribute");
    expect(trip.guest).toBe(true);
    expect(trip.money).toBe(false);
    expect(trip.people!.find((p) => p.me)!.name).toBe("Ann");

    // A name is picked once.
    expect((await joinableNames(token)).map((n) => n.name)).toEqual(["Ben"]);
    await expect(joinByLink(null, token, { personId: ann })).rejects.toThrow(/already picked/);
    await expect(joinByLink(null, token, { personId: kid })).rejects.toThrow(/already picked/);
    await expect(joinByLink(null, token, { name: "ann" })).rejects.toThrow(/already on this trip/);
    await expect(joinByLink(null, token, { name: "Ben" })).rejects.toThrow(/Pick it above/);
    await expect(joinByLink(null, token, { name: "  " })).rejects.toBeInstanceOf(InputError);

    // Members' powers, not an organizer's.
    const idea = await addStop(g, tripId, { title: "Tide pools" });
    expect(idea.planned).toBe(false);
    await expect(planStop(g, idea.id, "2027-06-06")).rejects.toBeInstanceOf(AccessDenied);
    const hike = await addStop(owner, tripId, { title: "Hike", day: "2027-06-06", askWho: true });
    await setAttendance(g, hike.id, ann, "going");
    await expect(setAttendance(g, hike.id, ben, "going")).rejects.toBeInstanceOf(AccessDenied);
    await expect(getTrip(g, await createTrip(owner, maine))).rejects.toBeInstanceOf(AccessDenied);
  });

  it("someone new types their name and lands on the trip's people list", async () => {
    await setLinkOptions(owner, tripId, { join: true, money: false });
    const g = await joinAs("Cal");
    const trip = await getTrip(owner, tripId);
    expect(trip.people!.map((p) => p.name)).toEqual(["Ann", "Ben", "Kit", "Cal"]);
    expect((await getTrip(g, tripId)).people!.find((p) => p.me)!.name).toBe("Cal");
  });

  it("Money only when the owner puts it on the link; receipt photos never", async () => {
    await setLinkOptions(owner, tripId, { join: true, money: false });
    const g = await joinAs("Ann");
    const expense = { description: "Groceries", amount: "90", spentOn: "2027-06-05", paidBy: ann, participants: [ann, ben] };
    await expect(ledger(g, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(addExpense(g, tripId, expense)).rejects.toBeInstanceOf(AccessDenied);

    await setLinkOptions(owner, tripId, { join: true, money: true });
    expect((await getTrip(g, tripId)).money).toBe(true);
    const id = await addExpense(g, tripId, expense);
    const l = await ledger(g, tripId);
    expect(l.expenses.map((e) => e.id)).toEqual([id]);

    const receipt = "00000000-0000-4000-8000-000000000000";
    await expect(addExpense(g, tripId, { ...expense, receiptId: receipt })).rejects.toBeInstanceOf(AccessDenied);
    await expect(uploadReceipt(g, tripId, Buffer.from("x"))).rejects.toBeInstanceOf(AccessDenied);
    await expect(openReceipt(g, receipt)).rejects.toBeInstanceOf(AccessDenied);
    await expect(discardReceipt(g, receipt)).rejects.toBeInstanceOf(AccessDenied);
    expect(await unsavedReceipts(g, tripId)).toEqual([]);
    expect((await receiptsByExpense(g, tripId)).size).toBe(0);

    // Members are unaffected by the switch.
    await setLinkOptions(owner, tripId, { join: true, money: false });
    expect((await getTrip(member, tripId)).money).toBe(true);
    await expect(ledger(g, tripId)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("each guest has their own link; the owner can turn a guest off", async () => {
    await setLinkOptions(owner, tripId, { join: true, money: false });
    const g = await joinAs("Ann");
    const own = await myGuestLink(g, tripId);
    expect(own).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await myGuestLink(member, tripId)).toBeNull();
    expect(await openGuestLink(own!)).toMatchObject({ tripId, userId: g.id, name: "Ann", tripName: "Maine" });
    expect(await openGuestLink("nope")).toBeNull();

    const sharing = await tripSharing(owner, tripId);
    expect(sharing.joiners.map((j) => [j.id, j.name])).toEqual([[g.id, "Ann"]]);
    // Guests are listed under the link, not as members, and can't be picked as people to add.
    expect(sharing.members.map((m) => m.id)).toEqual([member.id]);
    expect(sharing.people.some((p) => p.id === g.id)).toBe(false);
    // Saving the members list leaves guests alone.
    await setTripMembers(owner, tripId, { groupIds: [], userIds: [member.id] });
    expect((await getTrip(g, tripId)).role).toBe("contribute");
    await expect(setTripOrganizers(owner, tripId, [coorg.id, g.id])).rejects.toBeInstanceOf(InputError);

    await admin.query(`insert into "session" (id, "expiresAt", token, "updatedAt", "userId") values ($1, now() + interval '1 day', $1, now(), $2)`, [`s-${g.id}`, g.id]);
    await expect(turnOffJoiner(coorg, tripId, g.id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(turnOffJoiner(owner, tripId, member.id)).rejects.toBeInstanceOf(AccessDenied);
    await turnOffJoiner(owner, tripId, g.id);
    await expect(getTrip(g, tripId)).rejects.toBeInstanceOf(AccessDenied);
    expect(await openGuestLink(own!)).toBeNull();
    expect((await admin.query(`select 1 from "session" where "userId" = $1`, [g.id])).rowCount).toBe(0);
    expect((await joinableNames(token)).map((n) => n.name)).toEqual(["Ann", "Ben"]);
    expect((await tripSharing(owner, tripId)).joiners).toEqual([]);
  });

  it("signed in: you join as yourself, with no guest link", async () => {
    await setLinkOptions(owner, tripId, { join: true, money: false });
    const r = await joinByLink(outsider, token, { personId: ben });
    expect(r).toEqual({ tripId, newGuestId: null });
    const trip = await getTrip(outsider, tripId);
    expect(trip.role).toBe("contribute");
    expect(trip.guest).toBe(false);
    expect(trip.money).toBe(true);
    expect(trip.people!.find((p) => p.me)!.name).toBe("Ben");
    expect(await myGuestLink(outsider, tripId)).toBeNull();
    expect((await tripSharing(owner, tripId)).joiners).toEqual([]);
    // Already on it: nothing changes.
    expect(await joinByLink(member, token, { personId: ann })).toEqual({ tripId, newGuestId: null });
    expect((await joinableNames(token)).map((n) => n.name)).toEqual(["Ann"]);
  });

  it("a guest on one trip joins another as the same guest", async () => {
    await setLinkOptions(owner, tripId, { join: true, money: false });
    const g = await joinAs("Ann");
    const other = await createTrip(owner, { ...maine, name: "Cape" });
    await createTripLink(owner, other);
    await setLinkOptions(owner, other, { join: true, money: false });
    const otherToken = (await tripSharing(owner, other)).links[0].token;
    expect(await joinByLink(g, otherToken, { name: "Ann" })).toEqual({ tripId: other, newGuestId: null });
    expect((await getTrip(g, other)).role).toBe("contribute");
    expect(await myGuestLink(g, other)).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("a new trip link replaces the old one; guests' own links keep working", async () => {
    await setLinkOptions(owner, tripId, { join: true, money: false });
    const g = await joinAs("Ann");
    const own = await myGuestLink(g, tripId);
    await expect(replaceTripLink(coorg, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await replaceTripLink(owner, tripId);
    const links = (await tripSharing(owner, tripId)).links;
    expect(links).toHaveLength(1);
    expect(links[0].token).not.toBe(token);
    expect(await tripByLink(token)).toBeNull();
    await expect(joinByLink(null, token, { personId: ben })).rejects.toThrow(/isn't working/);
    expect(await tripByLink(links[0].token)).not.toBeNull();
    expect(await openGuestLink(own!)).not.toBeNull();
  });

  it("turning joining off stops new joins; people who joined stay until turned off", async () => {
    await setLinkOptions(owner, tripId, { join: true, money: false });
    const g = await joinAs("Ann");
    await setLinkOptions(owner, tripId, { join: false, money: false });
    await expect(joinByLink(null, token, { personId: ben })).rejects.toThrow(/Ask to join/);
    expect(await joinableNames(token)).toEqual([]);
    expect((await getTrip(g, tripId)).role).toBe("contribute");
  });

  it("guests never show up in People", async () => {
    await setLinkOptions(owner, tripId, { join: true, money: false });
    const g = await joinAs("Ann");
    const { listPeople } = await import("@/lib/people");
    expect((await listPeople(owner)).some((p) => p.id === g.id)).toBe(false);
  });
});
