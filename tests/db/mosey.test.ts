import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, addToGroup, createGroup, grantApp, grantItem, type Actor } from "@/lib/access";
import { InputError } from "@/lib/errors";
import {
  addStop,
  canOpenMosey,
  createTrip,
  createTripLink,
  deleteStop,
  deleteTrip,
  getTrip,
  planStop,
  revokeTripLink,
  setDayInfo,
  setTripMembers,
  tripByLink,
  tripSharing,
  tripsFor,
  updateStop,
  updateTrip,
} from "@/lib/mosey/trips";
import { pool } from "@/lib/db";

let hudson: Actor, molly: Actor, aunt: Actor, outsider: Actor;
let tripId: string;

const maine = { name: "Maine", place: "Bar Harbor", start: "2027-06-05", end: "2027-06-08" };

describeDb("Mosey trips", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    molly = await makeUser();
    aunt = await makeUser();
    outsider = await makeUser();
    tripId = await createTrip(hudson, maine);
    await setTripMembers(hudson, tripId, { groupIds: [], userIds: [molly.id] });
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("only people with Mosey can start trips; days fill in from the dates", async () => {
    await expect(createTrip(molly, maine)).rejects.toBeInstanceOf(AccessDenied);
    await grantApp(hudson, "mosey", { userId: aunt.id });
    expect(await createTrip(aunt, maine)).toMatch(/^[0-9a-f-]{36}$/);

    const trip = await getTrip(hudson, tripId);
    expect(trip.days).toEqual(["2027-06-05", "2027-06-06", "2027-06-07", "2027-06-08"]);
    expect(trip.organizer).toBe(true);

    await expect(createTrip(hudson, { ...maine, end: "2027-06-01" })).rejects.toBeInstanceOf(InputError);
    await expect(createTrip(hudson, { ...maine, start: "2027-02-30" })).rejects.toBeInstanceOf(InputError);
    await expect(createTrip(hudson, { ...maine, end: "2027-09-01" })).rejects.toThrow(/at most 60 days/);
    await expect(createTrip(hudson, { ...maine, name: " " })).rejects.toBeInstanceOf(InputError);
  });

  it("members see the trip; others get not found", async () => {
    expect((await getTrip(molly, tripId)).role).toBe("contribute");
    await expect(getTrip(outsider, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(getTrip(outsider, "not-a-uuid")).rejects.toBeInstanceOf(AccessDenied);
    expect((await tripsFor(molly)).map((t) => [t.name, t.organizer])).toEqual([["Maine", false]]);
    expect(await tripsFor(outsider)).toEqual([]);
    expect(await canOpenMosey(molly)).toBe(true);
    expect(await canOpenMosey(outsider)).toBe(false);
  });

  it("organizers plan; members add ideas and suggest a day for an organizer to confirm", async () => {
    const lobster = await addStop(hudson, tripId, { title: "Lobster shack", day: "2027-06-06", time: "18:30" });
    expect(lobster.planned).toBe(true);
    const hike = await addStop(molly, tripId, { title: "Beehive hike", day: "2027-06-07" });
    expect(hike.planned).toBe(false);
    await expect(addStop(outsider, tripId, { title: "Nope" })).rejects.toBeInstanceOf(AccessDenied);
    await expect(addStop(hudson, tripId, { title: "Off trip", day: "2027-07-01" })).rejects.toBeInstanceOf(InputError);

    let stops = (await getTrip(molly, tripId)).stops;
    expect(stops.find((s) => s.title === "Lobster shack")).toMatchObject({ day: "2027-06-06", time: "18:30" });
    expect(stops.find((s) => s.title === "Beehive hike")).toMatchObject({ day: null, suggestedDay: "2027-06-07", mine: true });

    await expect(planStop(molly, hike.id, "2027-06-07")).rejects.toBeInstanceOf(AccessDenied);
    await planStop(hudson, hike.id, "2027-06-07");
    stops = (await getTrip(molly, tripId)).stops;
    expect(stops.find((s) => s.title === "Beehive hike")).toMatchObject({ day: "2027-06-07", suggestedDay: null });

    await planStop(hudson, hike.id, null); // back to Ideas
    expect((await getTrip(hudson, tripId)).stops.find((s) => s.id === hike.id)?.day).toBeNull();
  });

  it("members edit and delete only their own ideas; organizers anything", async () => {
    const mine = await addStop(molly, tripId, { title: "Ice cream" });
    const his = await addStop(hudson, tripId, { title: "Groceries", day: "2027-06-05" });
    await updateStop(molly, mine.id, { title: "Ice cream at the pier" });
    await expect(updateStop(molly, his.id, { title: "Hijack" })).rejects.toBeInstanceOf(AccessDenied);
    await expect(deleteStop(molly, his.id)).rejects.toBeInstanceOf(AccessDenied);
    await updateStop(hudson, mine.id, { title: "Ice cream, Mount Desert" });

    await planStop(hudson, mine.id, "2027-06-06");
    await expect(deleteStop(molly, mine.id)).rejects.toBeInstanceOf(AccessDenied); // it's on the plan now
    await deleteStop(hudson, mine.id);
    expect((await getTrip(hudson, tripId)).stops.map((s) => s.title)).toEqual(["Groceries"]);
  });

  it("checks links and times", async () => {
    await expect(addStop(hudson, tripId, { title: "X", link: "javascript:alert(1)" })).rejects.toBeInstanceOf(InputError);
    await expect(addStop(hudson, tripId, { title: "X", time: "25:00" })).rejects.toBeInstanceOf(InputError);
    await expect(addStop(hudson, tripId, { title: " " })).rejects.toBeInstanceOf(InputError);
    const ok = await addStop(hudson, tripId, { title: "Site", link: "https://example.com/a" });
    expect((await getTrip(hudson, tripId)).stops.find((s) => s.id === ok.id)?.link).toBe("https://example.com/a");
  });

  it("a view-only link shows the plan and ideas, but not members-only details", async () => {
    await addStop(hudson, tripId, { title: "The cabin", day: "2027-06-05", place: "12 Private Rd", notes: "Code 4321", membersOnly: true });
    await addStop(hudson, tripId, { title: "Jordan Pond", day: "2027-06-06", place: "Jordan Pond House" });
    await createTripLink(hudson, tripId);
    const [link] = (await tripSharing(hudson, tripId)).links;

    const seen = await tripByLink(link.token);
    expect(seen?.name).toBe("Maine");
    expect(seen?.stops.find((s) => s.title === "The cabin")).toMatchObject({ place: "", notes: "", link: "", createdBy: null });
    expect(seen?.stops.find((s) => s.title === "Jordan Pond")?.place).toBe("Jordan Pond House");
    // Members see everything.
    expect((await getTrip(molly, tripId)).stops.find((s) => s.title === "The cabin")?.notes).toBe("Code 4321");

    await expect(createTripLink(molly, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await revokeTripLink(hudson, tripId, link.id);
    expect(await tripByLink(link.token)).toBeNull();
    expect(await tripByLink("A".repeat(32))).toBeNull();
  });

  it("a view grant sees what a link sees", async () => {
    await grantItem(hudson, { app: "mosey", type: "trip", id: tripId, ownerId: hudson.id }, { userId: aunt.id }, "view");
    await addStop(hudson, tripId, { title: "The cabin", day: "2027-06-05", place: "12 Private Rd", membersOnly: true });
    const t = await getTrip(aunt, tripId);
    expect(t.stops[0].place).toBe("");
    await expect(addStop(aunt, tripId, { title: "Can't" })).rejects.toBeInstanceOf(AccessDenied);
  });

  it("adds members by group or person, only from the organizer's own circles", async () => {
    const fam = await createGroup(hudson, "Family");
    await addToGroup(hudson, fam, aunt.id);
    await setTripMembers(hudson, tripId, { groupIds: [fam], userIds: [] });
    expect((await getTrip(aunt, tripId)).role).toBe("contribute");
    await expect(getTrip(molly, tripId)).rejects.toBeInstanceOf(AccessDenied); // removed

    await grantApp(hudson, "mosey", { userId: molly.id });
    const own = await createTrip(molly, maine);
    await expect(setTripMembers(molly, own, { groupIds: [fam], userIds: [] })).rejects.toBeInstanceOf(InputError);
    await expect(setTripMembers(molly, own, { groupIds: [], userIds: [outsider.id] })).rejects.toBeInstanceOf(InputError);
    await expect(setTripMembers(aunt, tripId, { groupIds: [], userIds: [] })).rejects.toBeInstanceOf(AccessDenied);
  });

  it("shortening a trip moves stops on dropped days back to Ideas", async () => {
    const last = await addStop(hudson, tripId, { title: "Drive home", day: "2027-06-08" });
    const sugg = await addStop(molly, tripId, { title: "Brunch", day: "2027-06-08" });
    await updateTrip(hudson, tripId, { ...maine, end: "2027-06-07" });
    const t = await getTrip(hudson, tripId);
    expect(t.days).toHaveLength(3);
    expect(t.stops.find((s) => s.id === last.id)).toMatchObject({ day: null });
    expect(t.stops.find((s) => s.id === sugg.id)).toMatchObject({ suggestedDay: null });
    await expect(updateTrip(molly, tripId, maine)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("deleting a trip removes its stops, members and links", async () => {
    await addStop(hudson, tripId, { title: "Anything" });
    await createTripLink(hudson, tripId);
    const [link] = (await tripSharing(hudson, tripId)).links;
    await expect(deleteTrip(molly, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await deleteTrip(hudson, tripId);
    expect(await tripByLink(link.token)).toBeNull();
    const left = await admin.query(
      `select (select count(*) from mosey_stops where trip_id = $1)::int as stops,
              (select count(*) from item_grants where app = 'mosey' and item_id = $1::text)::int as grants`,
      [tripId],
    );
    expect(left.rows[0]).toEqual({ stops: 0, grants: 0 });
  });

  it("a day's area and tag: organizers set them, everyone who sees the plan sees them", async () => {
    await grantItem(hudson, { app: "mosey", type: "trip", id: tripId, ownerId: hudson.id }, { userId: aunt.id }, "view");
    await setDayInfo(hudson, tripId, "2027-06-06", { area: " Bar Harbor → Acadia ", tag: "Travel day" });
    expect((await getTrip(molly, tripId)).dayInfo).toEqual({ "2027-06-06": { area: "Bar Harbor → Acadia", tag: "Travel day" } });
    expect((await getTrip(aunt, tripId)).dayInfo["2027-06-06"].tag).toBe("Travel day");
    await createTripLink(hudson, tripId);
    const [link] = (await tripSharing(hudson, tripId)).links;
    expect((await tripByLink(link.token))!.dayInfo["2027-06-06"].area).toBe("Bar Harbor → Acadia");

    // Members suggest stops but don't label days; nobody else can at all.
    for (const who of [molly, aunt, outsider]) {
      await expect(setDayInfo(who, tripId, "2027-06-06", { area: "Hijack", tag: "" })).rejects.toBeInstanceOf(AccessDenied);
    }
    await expect(setDayInfo(hudson, tripId, "2027-06-20", { area: "Later", tag: "" })).rejects.toBeInstanceOf(InputError);
    await expect(setDayInfo(hudson, tripId, "June 6", { area: "x", tag: "" })).rejects.toBeInstanceOf(InputError);
    await expect(setDayInfo(hudson, tripId, "2027-06-06", { area: "x".repeat(81), tag: "" })).rejects.toBeInstanceOf(InputError);

    // A day the trip no longer covers isn't shown; clearing both removes it.
    await updateTrip(hudson, tripId, { ...maine, start: "2027-06-07" });
    expect((await getTrip(hudson, tripId)).dayInfo).toEqual({});
    await updateTrip(hudson, tripId, maine);
    await setDayInfo(hudson, tripId, "2027-06-06", { area: "", tag: "" });
    expect((await admin.query("select count(*)::int as n from mosey_days where trip_id = $1", [tripId])).rows[0].n).toBe(0);
  });
});
