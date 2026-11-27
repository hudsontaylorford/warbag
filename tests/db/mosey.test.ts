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
  setTripOrganizers,
  moveStop,
  createChoice,
  setStopChoice,
  ungroupChoice,
  setAttendance,
  setDayInfo,
  setTripMembers,
  tripByLink,
  tripSharing,
  tripsFor,
  updateStop,
  updateTrip,
} from "@/lib/mosey/trips";
import { addPerson, removePerson } from "@/lib/mosey/ledger";
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
    await setDayInfo(hudson, tripId, "2027-06-06", { area: " Bar Harbor → Acadia ", tag: "Travel day", staying: "" });
    expect((await getTrip(molly, tripId)).dayInfo).toEqual({ "2027-06-06": { area: "Bar Harbor → Acadia", tag: "Travel day", staying: "" } });
    expect((await getTrip(aunt, tripId)).dayInfo["2027-06-06"].tag).toBe("Travel day");
    await createTripLink(hudson, tripId);
    const [link] = (await tripSharing(hudson, tripId)).links;
    expect((await tripByLink(link.token))!.dayInfo["2027-06-06"].area).toBe("Bar Harbor → Acadia");

    // Members suggest stops but don't label days; nobody else can at all.
    for (const who of [molly, aunt, outsider]) {
      await expect(setDayInfo(who, tripId, "2027-06-06", { area: "Hijack", tag: "", staying: "" })).rejects.toBeInstanceOf(AccessDenied);
    }
    await expect(setDayInfo(hudson, tripId, "2027-06-20", { area: "Later", tag: "", staying: "" })).rejects.toBeInstanceOf(InputError);
    await expect(setDayInfo(hudson, tripId, "June 6", { area: "x", tag: "", staying: "" })).rejects.toBeInstanceOf(InputError);
    await expect(setDayInfo(hudson, tripId, "2027-06-06", { area: "x".repeat(81), tag: "", staying: "" })).rejects.toBeInstanceOf(InputError);

    // Where people stay: members see it; a view grant and the trip link never do (it may be an address).
    await setDayInfo(hudson, tripId, "2027-06-06", { area: "Bar Harbor → Acadia", tag: "", staying: " Cabin on Ocean Drive " });
    await setDayInfo(hudson, tripId, "2027-06-07", { area: "", tag: "", staying: "Cabin on Ocean Drive" });
    expect((await getTrip(molly, tripId)).dayInfo["2027-06-06"].staying).toBe("Cabin on Ocean Drive");
    expect((await getTrip(hudson, tripId)).dayInfo["2027-06-07"]).toEqual({ area: "", tag: "", staying: "Cabin on Ocean Drive" });
    expect((await getTrip(aunt, tripId)).dayInfo["2027-06-06"].staying).toBe("");
    expect((await getTrip(aunt, tripId)).dayInfo["2027-06-07"]).toBeUndefined();
    expect((await tripByLink(link.token))!.dayInfo["2027-06-06"]).toEqual({ area: "Bar Harbor → Acadia", tag: "", staying: "" });
    expect((await tripByLink(link.token))!.dayInfo["2027-06-07"]).toBeUndefined();
    await expect(setDayInfo(hudson, tripId, "2027-06-06", { area: "", tag: "", staying: "x".repeat(121) })).rejects.toBeInstanceOf(InputError);
    await setDayInfo(hudson, tripId, "2027-06-07", { area: "", tag: "", staying: "" });

    // A day the trip no longer covers isn't shown; clearing all three removes it.
    await updateTrip(hudson, tripId, { ...maine, start: "2027-06-07" });
    expect((await getTrip(hudson, tripId)).dayInfo).toEqual({});
    await updateTrip(hudson, tripId, maine);
    await setDayInfo(hudson, tripId, "2027-06-06", { area: "", tag: "", staying: "" });
    expect((await admin.query("select count(*)::int as n from mosey_days where trip_id = $1", [tripId])).rows[0].n).toBe(0);
  });

  it("when: typed times, parts of the day and TBD are kept and sorted sensibly", async () => {
    const day = "2027-06-06";
    const add = (title: string, time: string) => addStop(hudson, tripId, { title, day, time });
    await add("Anytime snack", "");
    await add("Dinner", "7pm");
    await add("Ferry", "time TBD");
    await add("Hike", "morning");
    await add("Coffee", "8:30a");
    await add("Sunset", "evening");
    await add("Lunch", "12:30p");
    const stops = (await getTrip(hudson, tripId)).stops.filter((s) => s.day === day);
    expect(stops.map((s) => [s.title, s.time, s.part])).toEqual([
      ["Hike", null, "morning"],
      ["Coffee", "08:30", null],
      ["Lunch", "12:30", null],
      ["Sunset", null, "evening"],
      ["Dinner", "19:00", null],
      // Untimed stops (time TBD, any time) keep the order they were given.
      ["Anytime snack", null, null],
      ["Ferry", null, "tbd"],
    ]);
    await expect(add("Bad", "soonish")).rejects.toThrow(/isn't a time we recognize/);
    // Changing an exact time to a part of the day clears the time, and back.
    const dinner = stops.find((s) => s.title === "Dinner")!;
    await updateStop(hudson, dinner.id, { title: "Dinner", time: "evening" });
    let d = (await getTrip(hudson, tripId)).stops.find((s) => s.id === dinner.id)!;
    expect([d.time, d.part]).toEqual([null, "evening"]);
    await updateStop(hudson, dinner.id, { title: "Dinner", time: "19:15" });
    d = (await getTrip(hudson, tripId)).stops.find((s) => s.id === dinner.id)!;
    expect([d.time, d.part]).toEqual(["19:15", null]);
  });

  it("a stop's status: set with the stop, shown everywhere, only known words", async () => {
    const id = (await addStop(hudson, tripId, { title: "Cabin", day: "2027-06-05", status: "asked" })).id;
    expect((await getTrip(molly, tripId)).stops.find((s) => s.id === id)!.status).toBe("asked");
    await updateStop(hudson, id, { title: "Cabin", status: "booked" });
    await createTripLink(hudson, tripId);
    const [link] = (await tripSharing(hudson, tripId)).links;
    expect((await tripByLink(link.token))!.stops.find((s) => s.id === id)!.status).toBe("booked");
    await expect(updateStop(hudson, id, { title: "Cabin", status: "paid" })).rejects.toBeInstanceOf(InputError);
    await updateStop(hudson, id, { title: "Cabin", status: "" });
    expect((await getTrip(hudson, tripId)).stops.find((s) => s.id === id)!.status).toBeNull();
  });

  it("who's going: organizers mark anyone, members only themselves, nobody else sees it", async () => {
    await grantItem(hudson, { app: "mosey", type: "trip", id: tripId, ownerId: hudson.id }, { userId: aunt.id }, "view");
    const ann = await addPerson(hudson, tripId, { name: "Ann", userId: hudson.id });
    const ben = await addPerson(hudson, tripId, { name: "Ben", userId: molly.id });
    const kid = await addPerson(hudson, tripId, { name: "Kid" });
    const ski = (await addStop(hudson, tripId, { title: "Ski", day: "2027-06-06", askWho: true })).id;
    const idea = (await addStop(molly, tripId, { title: "Spa", askWho: true })).id;
    // Stops that don't ask are everyone: nobody can be marked on them.
    const dinner = (await addStop(hudson, tripId, { title: "Dinner", day: "2027-06-06" })).id;
    expect((await getTrip(molly, tripId)).stops.find((s) => s.id === dinner)!.askWho).toBe(false);
    await expect(setAttendance(hudson, dinner, ann, "going")).rejects.toThrow(/Ask who's going/);

    await setAttendance(hudson, ski, kid, "going"); // an organizer marks anyone
    await setAttendance(molly, ski, ben, "maybe"); // a member marks themselves
    await setAttendance(molly, idea, ben, "going"); // ideas too
    await expect(setAttendance(molly, ski, ann, "going")).rejects.toBeInstanceOf(AccessDenied); // not someone else
    await expect(setAttendance(aunt, ski, kid, "going")).rejects.toBeInstanceOf(AccessDenied); // viewers can't
    await expect(setAttendance(outsider, ski, kid, "going")).rejects.toBeInstanceOf(AccessDenied);
    await expect(setAttendance(hudson, ski, kid, "sure" as "going")).rejects.toBeInstanceOf(InputError);
    // Someone from another trip can't be marked.
    const other = await createTrip(hudson, { ...maine, name: "Other" });
    const zed = await addPerson(hudson, other, { name: "Zed" });
    await expect(setAttendance(hudson, ski, zed, "going")).rejects.toBeInstanceOf(AccessDenied);

    const t = await getTrip(molly, tripId);
    expect(t.people!.map((p) => [p.name, p.me])).toEqual([["Ann", false], ["Ben", true], ["Kid", false]]);
    expect(t.attendance![ski]).toEqual([
      { personId: ben, state: "maybe" },
      { personId: kid, state: "going" },
    ]);
    expect(t.attendance![idea]).toEqual([{ personId: ben, state: "going" }]);
    // Viewers and view links never see names or attendance.
    const seen = await getTrip(aunt, tripId);
    expect(seen.people).toBeUndefined();
    expect(seen.attendance).toBeUndefined();
    await createTripLink(hudson, tripId);
    const [link] = (await tripSharing(hudson, tripId)).links;
    const byLink = (await tripByLink(link.token))!;
    expect(byLink.people).toBeUndefined();
    expect(JSON.stringify(byLink)).not.toContain("Kid");

    // Clearing, and removing a person, take their marks away.
    await setAttendance(molly, ski, ben, null);
    await removePerson(hudson, tripId, kid);
    expect((await getTrip(hudson, tripId)).attendance![ski]).toBeUndefined();
  });

  it("meals: a stop or idea can be a meal with who's handling it; untimed meals sit at their usual hour", async () => {
    const day = "2027-06-06";
    await addStop(hudson, tripId, { title: "Hike", day, time: "morning" });
    const dinner = (await addStop(hudson, tripId, { title: "Family dinner", day, meal: "dinner", handledBy: "Ann cooking, Ben brings pie" })).id;
    await addStop(hudson, tripId, { title: "Pancakes", day, meal: "breakfast" });
    await addStop(hudson, tripId, { title: "Movie", day, time: "8pm" });
    await addStop(hudson, tripId, { title: "Lunch spot", day, time: "1pm", meal: "lunch" });
    const t = await getTrip(molly, tripId);
    expect(t.stops.filter((s) => s.day === day).map((s) => [s.title, s.meal])).toEqual([
      ["Hike", null],
      ["Pancakes", "breakfast"],
      ["Lunch spot", "lunch"],
      ["Family dinner", "dinner"],
      ["Movie", null],
    ]);
    expect(t.stops.find((s) => s.id === dinner)!.handledBy).toBe("Ann cooking, Ben brings pie");
    await expect(addStop(hudson, tripId, { title: "Bad", meal: "brunch" })).rejects.toBeInstanceOf(InputError);
    await expect(addStop(hudson, tripId, { title: "Long", meal: "dinner", handledBy: "x".repeat(201) })).rejects.toBeInstanceOf(InputError);

    // Who's handling a members-only meal stays off view links, like its notes.
    await updateStop(hudson, dinner, { title: "Family dinner", meal: "dinner", handledBy: "Ann cooking", membersOnly: true });
    await createTripLink(hudson, tripId);
    const [link] = (await tripSharing(hudson, tripId)).links;
    const seen = (await tripByLink(link.token))!.stops.find((s) => s.id === dinner)!;
    expect([seen.meal, seen.handledBy]).toEqual(["dinner", ""]);
  });

  it("options: one pick per person, organizers group and ungroup, a lone option stands alone", async () => {
    const day = "2027-06-07";
    const ann = await addPerson(hudson, tripId, { name: "Ann", userId: hudson.id });
    const ben = await addPerson(hudson, tripId, { name: "Ben", userId: molly.id });
    await expect(createChoice(molly, tripId, { day, title: "Monday afternoon", options: ["Ski", "Hike"] })).rejects.toBeInstanceOf(AccessDenied);
    await expect(createChoice(hudson, tripId, { day, title: "Monday afternoon", options: ["Ski", " "] })).rejects.toThrow(/at least two/);
    await expect(createChoice(hudson, tripId, { day: "2027-07-01", title: "Later", options: ["A", "B"] })).rejects.toBeInstanceOf(InputError);
    const choice = await createChoice(hudson, tripId, { day, title: "Monday afternoon", options: ["Ski", "Hike", "Spa"] });
    let t = await getTrip(molly, tripId);
    expect(t.choices[choice].title).toBe("Monday afternoon");
    const opt = (title: string) => t.stops.find((s) => s.title === title)!;
    const [ski, hike, spa] = [opt("Ski"), opt("Hike"), opt("Spa")];
    expect([ski.day, ski.choiceId, ski.askWho]).toEqual([day, choice, true]);

    // Picking another option moves the pick; "maybe" isn't a pick.
    await setAttendance(molly, ski.id, ben, "going");
    await setAttendance(molly, spa.id, ben, "going");
    await setAttendance(hudson, ski.id, ann, "going");
    await expect(setAttendance(molly, hike.id, ben, "maybe")).rejects.toThrow(/pick one/);
    t = await getTrip(molly, tripId);
    expect(t.attendance![ski.id]).toEqual([{ personId: ann, state: "going" }]);
    expect(t.attendance![spa.id]).toEqual([{ personId: ben, state: "going" }]);

    // Grouping a stop from another day is refused; same day works.
    const other = (await addStop(hudson, tripId, { title: "Museum", day: "2027-06-06" })).id;
    await expect(setStopChoice(hudson, other, choice)).rejects.toThrow(/same day/);
    const nap = (await addStop(hudson, tripId, { title: "Nap", day })).id;
    await expect(setStopChoice(molly, nap, choice)).rejects.toBeInstanceOf(AccessDenied);
    await setStopChoice(hudson, nap, choice);
    expect((await getTrip(hudson, tripId)).stops.find((s) => s.id === nap)!.choiceId).toBe(choice);

    // Moving options away until one is left dissolves the choice; that one stays a stop.
    await planStop(hudson, nap, null);
    await setStopChoice(hudson, hike.id, null);
    await deleteStop(hudson, spa.id);
    t = await getTrip(hudson, tripId);
    expect(t.choices[choice]).toBeUndefined();
    expect(t.stops.find((s) => s.id === ski.id)!.choiceId).toBeNull();
    expect(t.attendance![ski.id]).toEqual([{ personId: ann, state: "going" }]); // picks are kept

    // Ungrouping keeps the options and the picks.
    const c2 = await createChoice(hudson, tripId, { day, title: "Dinner", options: ["Pizza", "Tacos"] });
    const pizza = (await getTrip(hudson, tripId)).stops.find((s) => s.title === "Pizza")!;
    await setAttendance(hudson, pizza.id, ann, "going");
    await expect(ungroupChoice(molly, tripId, c2)).rejects.toBeInstanceOf(AccessDenied);
    await ungroupChoice(hudson, tripId, c2);
    t = await getTrip(hudson, tripId);
    expect(t.stops.filter((s) => ["Pizza", "Tacos"].includes(s.title)).map((s) => s.choiceId)).toEqual([null, null]);
    expect(t.attendance![pizza.id]).toEqual([{ personId: ann, state: "going" }]);
  });

  it("reorder: untimed stops go anywhere, times still set the order, organizers only", async () => {
    const day = "2027-06-06";
    const add = async (title: string, time = "") => (await addStop(hudson, tripId, { title, day, time })).id;
    await add("Van pickup", "12pm");
    const drive = await add("Drive north", "1:30p");
    const groceries = await add("Groceries on the way");
    const ferry = await add("Ferry", "TBD");
    const order = async () => (await getTrip(hudson, tripId)).stops.filter((s) => s.day === day).map((s) => s.title);
    expect(await order()).toEqual(["Van pickup", "Drive north", "Groceries on the way", "Ferry"]);

    await moveStop(hudson, groceries, "up"); // between pickup and the drive
    expect(await order()).toEqual(["Van pickup", "Groceries on the way", "Drive north", "Ferry"]);
    await moveStop(hudson, groceries, "up"); // first of the day
    expect(await order()).toEqual(["Groceries on the way", "Van pickup", "Drive north", "Ferry"]);
    await moveStop(hudson, groceries, "down");
    await moveStop(hudson, ferry, "up"); // a TBD stop moves like any untimed one
    expect(await order()).toEqual(["Van pickup", "Groceries on the way", "Ferry", "Drive north"]);

    // A timed stop can move past an untimed one: the untimed one now sits after it.
    await moveStop(hudson, drive, "up");
    expect(await order()).toEqual(["Van pickup", "Groceries on the way", "Drive north", "Ferry"]);
    // Two stops at different times can't swap.
    await moveStop(hudson, groceries, "down");
    expect(await order()).toEqual(["Van pickup", "Drive north", "Groceries on the way", "Ferry"]);
    await expect(moveStop(hudson, drive, "up")).rejects.toThrow(/Times set the order/);
    // Stops at the same time swap freely; the first stop can't go higher.
    const lunch = await add("Lunch", "12pm");
    expect(await order()).toEqual(["Van pickup", "Lunch", "Drive north", "Groceries on the way", "Ferry"]);
    await moveStop(hudson, lunch, "up");
    expect(await order()).toEqual(["Lunch", "Van pickup", "Drive north", "Groceries on the way", "Ferry"]);
    await moveStop(hudson, lunch, "up");
    expect((await order())[0]).toBe("Lunch");
    await expect(moveStop(molly, groceries, "up")).rejects.toBeInstanceOf(AccessDenied);
    await expect(moveStop(outsider, groceries, "up")).rejects.toBeInstanceOf(AccessDenied);
  });

  it("co-organizers do everything on the trip except share it or delete it", async () => {
    const agent = await makeUser(); // e.g. an assistant's own account, not an admin
    await setTripOrganizers(hudson, tripId, [agent.id]);
    expect((await tripSharing(hudson, tripId)).organizers.map((o) => o.id)).toEqual([agent.id]);
    const t = await getTrip(agent, tripId);
    expect([t.organizer, t.owner]).toEqual([true, false]);

    // Plans, money and settle-up, like the owner.
    const idea = (await addStop(agent, tripId, { title: "Boat tour" })).id;
    await planStop(agent, idea, "2027-06-06");
    const ann = await addPerson(agent, tripId, { name: "Ann" });
    expect(ann).toBeTruthy();
    await updateTrip(agent, tripId, { ...maine, name: "Maine trip" });

    // Not sharing, not deleting.
    await expect(tripSharing(agent, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(setTripMembers(agent, tripId, { groupIds: [], userIds: [] })).rejects.toBeInstanceOf(AccessDenied);
    await expect(setTripOrganizers(agent, tripId, [])).rejects.toBeInstanceOf(AccessDenied);
    await expect(createTripLink(agent, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(deleteTrip(agent, tripId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(setTripOrganizers(molly, tripId, [molly.id])).rejects.toBeInstanceOf(AccessDenied);

    // Saving the members list never downgrades a co-organizer.
    await setTripMembers(hudson, tripId, { groupIds: [], userIds: [molly.id, agent.id] });
    expect((await getTrip(agent, tripId)).organizer).toBe(true);
    // The owner takes it away; it applies on the next request.
    await setTripOrganizers(hudson, tripId, []);
    await expect(getTrip(agent, tripId)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("Gyfte's sample family never shows up in Mosey's sharing and can't be added", async () => {
    const sampleGroup = await createGroup(hudson, "Sample family");
    await admin.query("insert into gyfte_groups (name, access_group_id, is_sample, created_by) values ('Sample family', $1, true, $2)", [sampleGroup, hudson.id]);
    const sampleId = crypto.randomUUID();
    await admin.query(
      `insert into "user" ("id", "name", "email", "emailVerified", "updatedAt") values ($1, 'Sample Sam', $2, true, now())`,
      [sampleId, `${sampleId}@sample.invalid`],
    );
    const sharing = await tripSharing(hudson, tripId);
    expect(sharing.groups.map((g) => g.id)).not.toContain(sampleGroup);
    expect(sharing.people.map((p) => p.id)).not.toContain(sampleId);
    await expect(setTripMembers(hudson, tripId, { groupIds: [sampleGroup], userIds: [] })).rejects.toBeInstanceOf(InputError);
    await expect(setTripMembers(hudson, tripId, { groupIds: [], userIds: [sampleId] })).rejects.toBeInstanceOf(InputError);
    await expect(setTripOrganizers(hudson, tripId, [sampleId])).rejects.toBeInstanceOf(InputError);
  });
});
