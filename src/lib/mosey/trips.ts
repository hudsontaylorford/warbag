import "server-only";
import type { PoolClient } from "pg";
import { parseWhen, type Part, type When } from "./when";
import { removeReceiptImages } from "./receipts";
import { pool } from "../db";
import { InputError } from "../errors";
import {
  AccessDenied,
  atLeast,
  canUseApp,
  createShareLink,
  forgetItem,
  grantItem,
  groupsFor,
  itemsSharedWith,
  itemRole,
  listItemGrants,
  listShareLinks,
  resolveShareLink,
  revokeItem,
  revokeShareLink,
  type Actor,
  type ItemRef,
  type Role,
} from "../access";

/**
 * Mosey trips. Access uses the shared tables with app "mosey", type "trip":
 *   manage      organizer: edits the trip, puts ideas on the plan; the owner
 *               (or an admin) also shares it and deletes it, co-organizers don't
 *   contribute  member: adds ideas (and suggests a day), edits their own
 *   view        viewer, including view-only links: Plan and Ideas, never
 *               members-only details
 * Every function checks the person's level itself.
 */

export const APP = "mosey";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 60;

type TripRow = {
  id: string;
  owner_id: string;
  name: string;
  place: string;
  start_date: string;
  end_date: string;
  /** People with the trip link can join and edit (like chirk). */
  link_join: boolean;
  /** Guests who joined by link see Money too. */
  link_money: boolean;
};

export const STATUSES = ["tentative", "asked", "confirmed", "booked"] as const;
export type Status = (typeof STATUSES)[number];
export type Attending = "going" | "maybe";
export const MEALS = ["breakfast", "lunch", "dinner", "food"] as const;
export type Meal = (typeof MEALS)[number];

export type Stop = {
  id: string;
  day: string | null;
  suggestedDay: string | null;
  time: string | null;
  /** Part of the day or "tbd" when there's no exact time; both null is any time. */
  part: Part | null;
  /** Tentative, inquiry sent, confirmed or booked; null is no status. */
  status: Status | null;
  /** Breakfast, lunch, dinner or other food and drink; null when it isn't a meal. */
  meal: Meal | null;
  /** Ask who's going (split, limited or optional plans). Otherwise everyone goes. */
  askWho: boolean;
  /** The choice this stop is one option of ("Monday afternoon: ski, hike or spa"). */
  choiceId: string | null;
  /** Who's cooking, bringing or booking it. Hidden like notes on members-only stops. */
  handledBy: string;
  title: string;
  place: string;
  link: string;
  notes: string;
  membersOnly: boolean;
  createdBy: string | null;
  mine: boolean;
};

export type TripSummary = { id: string; name: string; place: string; startDate: string; endDate: string; organizer: boolean };

/** A day's optional area and tag. Empty strings when not set. */
export type DayInfo = { area: string; tag: string };

export type TripDetail = TripSummary & {
  role: Role;
  /** The trip's owner (or an admin): only they share it or delete it. Co-organizers do the rest. */
  owner: boolean;
  /** May open Money: members, and guests when the trip puts Money on the link. */
  money: boolean;
  /** Joined by the trip link (a guest account). */
  guest: boolean;
  /** The trip link lets people join and edit. */
  linkJoin: boolean;
  days: string[];
  /** Area and tag by day, only for days that have one. */
  dayInfo: Record<string, DayInfo>;
  /** Choices between options, by id. */
  choices: Record<string, { title: string }>;
  stops: Stop[];
  /** Members only: the trip's people (from Money), and who's going to what. */
  people?: { id: string; name: string; me: boolean }[];
  attendance?: Record<string, { personId: string; state: Attending }[]>;
};

const ref = (t: { id: string; owner_id: string }): ItemRef => ({ app: APP, type: "trip", id: t.id, ownerId: t.owner_id });

// ------------------------------------------------------------ small helpers

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** A real calendar day "YYYY-MM-DD", or null. */
export function parseDay(raw: string): string | null {
  if (!DAY.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || isoDay(d) !== raw ? null : raw;
}

/** Every day from start to end, inclusive. */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${start}T00:00:00Z`); isoDay(d) <= end && out.length <= MAX_DAYS; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(isoDay(d));
  }
  return out;
}

function cleanText(raw: unknown, max: number, label: string): string {
  const s = String(raw ?? "").trim();
  if (s.length > max) throw new InputError(`${label} is at most ${max} characters.`);
  return s;
}

function cleanLink(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    return u.toString().slice(0, 2000);
  } catch {
    throw new InputError("Links start with https://");
  }
}

/** The one "When" box: "7pm", "9:30a", "14:30", "morning", "TBD", or empty for any time. */
function cleanWhen(raw: unknown): When {
  const w = parseWhen(String(raw ?? ""));
  if (!w.ok) throw new InputError(w.error);
  return { time: w.time, part: w.part };
}

// ------------------------------------------------------------ access

async function tripRow(id: string): Promise<TripRow | null> {
  if (!UUID.test(id)) return null;
  const { rows } = await pool.query<TripRow>(
    `select id, owner_id, name, place, to_char(start_date, 'YYYY-MM-DD') as start_date,
       to_char(end_date, 'YYYY-MM-DD') as end_date, link_join, link_money
     from mosey_trips where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Sharing a trip and deleting it: its owner (or an admin), never a co-organizer. */
export async function ownerOnly(actor: Actor, id: string) {
  const r = await tripWithRole(actor, id, "manage");
  if (r.trip.owner_id !== actor.id && !actor.isAdmin) throw new AccessDenied();
  return r;
}

/** The trip and the person's level, or AccessDenied (shown as "not found"). */
export async function tripWithRole(actor: Actor | null, id: string, need: Role, linkToken?: string) {
  const trip = await tripRow(id);
  if (!trip) throw new AccessDenied();
  const role = await itemRole(actor, ref(trip), { linkToken });
  if (!atLeast(role, need)) throw new AccessDenied();
  return { trip, role: role! };
}

/**
 * Money (expenses, households, who owes whom): members and organizers; a
 * guest who joined by link only when the owner put Money on the link.
 */
export function canSeeMoney(actor: Actor, trip: { link_money: boolean }, role: Role | null): boolean {
  if (!atLeast(role, "contribute")) return false;
  return actor.guest !== true || trip.link_money;
}

export async function canUseMosey(actor: Actor): Promise<boolean> {
  return canUseApp(actor, APP);
}

/** May open Mosey at all: app access, or a trip shared with them. */
export async function canOpenMosey(actor: Actor): Promise<boolean> {
  if (await canUseMosey(actor)) return true;
  return (await itemsSharedWith(actor, APP, "trip")).length > 0;
}

// ------------------------------------------------------------ trips

function readTripInput(input: { name: string; place?: string; start: string; end: string }) {
  const name = cleanText(input.name, 80, "A trip name");
  if (!name) throw new InputError("Give the trip a name.");
  const place = cleanText(input.place, 120, "The place");
  const start = parseDay(String(input.start ?? ""));
  const end = parseDay(String(input.end ?? ""));
  if (!start || !end) throw new InputError("Pick the first and last day.");
  if (end < start) throw new InputError("The last day is before the first day.");
  if (daysBetween(start, end).length > MAX_DAYS) throw new InputError(`Trips are at most ${MAX_DAYS} days.`);
  return { name, place, start, end };
}

export async function createTrip(
  actor: Actor,
  input: { name: string; place?: string; start: string; end: string },
): Promise<string> {
  if (!(await canUseMosey(actor))) throw new AccessDenied();
  const t = readTripInput(input);
  const { rows } = await pool.query<{ id: string }>(
    `insert into mosey_trips (owner_id, name, place, start_date, end_date) values ($1, $2, $3, $4, $5) returning id`,
    [actor.id, t.name, t.place, t.start, t.end],
  );
  return rows[0].id;
}

export async function updateTrip(
  actor: Actor,
  id: string,
  input: { name: string; place?: string; start: string; end: string },
): Promise<void> {
  const { trip } = await tripWithRole(actor, id, "manage");
  const t = readTripInput(input);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update mosey_trips set name = $2, place = $3, start_date = $4, end_date = $5, updated_at = now() where id = $1`,
      [trip.id, t.name, t.place, t.start, t.end],
    );
    // Stops on days the trip no longer covers go back to Ideas, not away.
    await client.query(
      `update mosey_stops set day = null, suggested_day = null, updated_at = now()
       where trip_id = $1 and (day < $2 or day > $3)`,
      [trip.id, t.start, t.end],
    );
    await client.query(
      `update mosey_stops set suggested_day = null where trip_id = $1 and (suggested_day < $2 or suggested_day > $3)`,
      [trip.id, t.start, t.end],
    );
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteTrip(actor: Actor, id: string): Promise<void> {
  const { trip } = await ownerOnly(actor, id);
  await forgetItem(actor, ref(trip));
  // Receipt photos live outside the database: delete them once the trip is gone.
  const photos = await pool.query<{ blob_path: string }>("select blob_path from mosey_receipts where trip_id = $1", [trip.id]);
  await pool.query("delete from mosey_trips where id = $1", [trip.id]);
  await removeReceiptImages(photos.rows.map((r) => r.blob_path));
}

/** Trips this person organizes or was added to, soonest first. */
export async function tripsFor(actor: Actor): Promise<TripSummary[]> {
  const shared = (await itemsSharedWith(actor, APP, "trip")).map((s) => s.id).filter((id) => UUID.test(id));
  const { rows } = await pool.query<TripRow>(
    `select id, owner_id, name, place, to_char(start_date, 'YYYY-MM-DD') as start_date,
       to_char(end_date, 'YYYY-MM-DD') as end_date, link_join, link_money
     from mosey_trips where owner_id = $1 or id = any($2::uuid[])
     order by start_date desc`,
    [actor.id, shared],
  );
  const out: TripSummary[] = [];
  for (const t of rows) {
    const role = await itemRole(actor, ref(t));
    out.push({ id: t.id, name: t.name, place: t.place, startDate: t.start_date, endDate: t.end_date, organizer: role === "manage" });
  }
  return out;
}

async function stopsOf(tripId: string, viewerId: string | null, linkOnly: boolean): Promise<Stop[]> {
  const { rows } = await pool.query<{
    id: string;
    day: string | null;
    suggested_day: string | null;
    at_time: string | null;
    time_of_day: Part | null;
    status: Status | null;
    meal: Meal | null;
    handled_by: string;
    ask_attendance: boolean;
    choice_id: string | null;
    title: string;
    place: string;
    link: string;
    notes: string;
    members_only: boolean;
    created_by: string | null;
  }>(
    `select id, to_char(day, 'YYYY-MM-DD') as day, to_char(suggested_day, 'YYYY-MM-DD') as suggested_day,
       to_char(at_time, 'HH24:MI') as at_time, time_of_day, status, meal, handled_by, ask_attendance, choice_id, title, place, link, notes, members_only, created_by
     from mosey_stops where trip_id = $1
     -- Times set the order: parts of the day sit at the start of their
     -- window, a meal with no time at its usual hour, an untimed stop where
     -- it was moved to (sort_at), otherwise last. Ties follow position.
     order by day nulls last, ${SORT_KEY} nulls last, position, created_at`,
    [tripId],
  );
  return rows.map((r) => {
    // A view-only link sees members-only stops as a title, nothing more.
    const hide = linkOnly && r.members_only;
    return {
      id: r.id,
      day: r.day,
      suggestedDay: r.suggested_day,
      time: r.at_time,
      part: r.time_of_day,
      status: r.status,
      meal: r.meal,
      askWho: r.ask_attendance,
      choiceId: r.choice_id,
      handledBy: hide ? "" : r.handled_by,
      title: r.title,
      place: hide ? "" : r.place,
      link: hide ? "" : r.link,
      notes: hide ? "" : r.notes,
      membersOnly: r.members_only,
      createdBy: linkOnly ? null : r.created_by,
      mine: viewerId !== null && r.created_by === viewerId,
    };
  });
}

/** Where a stop sits in its day, as a time; null sorts last. Mirrors fixedKey below. */
const SORT_KEY = `coalesce(at_time,
  case time_of_day when 'morning' then time '05:00' when 'afternoon' then time '12:00' when 'evening' then time '17:00' end,
  case when time_of_day is null then case meal when 'breakfast' then time '08:00' when 'lunch' then time '12:30' when 'dinner' then time '18:30' end end,
  sort_at)`;

type OrderRow = { id: string; at_time: string | null; time_of_day: Part | null; meal: Meal | null; sort_at: string | null };

/** The time a stop's own details pin it to, or null when it floats (any time, time TBD). */
function fixedKey(r: OrderRow): string | null {
  if (r.at_time) return r.at_time;
  if (r.time_of_day === "morning") return "05:00";
  if (r.time_of_day === "afternoon") return "12:00";
  if (r.time_of_day === "evening") return "17:00";
  if (!r.time_of_day && r.meal === "breakfast") return "08:00";
  if (!r.time_of_day && r.meal === "lunch") return "12:30";
  if (!r.time_of_day && r.meal === "dinner") return "18:30";
  return null;
}

/**
 * Moves a stop one place up or down in its day. Organizers only. Times still
 * set the order: an untimed stop can go anywhere (it takes the time of the
 * stop it moves next to), while two stops at different times can't swap.
 */
export async function moveStop(actor: Actor, stopId: string, direction: "up" | "down"): Promise<void> {
  const { trip, role } = await stopWithTrip(actor, stopId);
  if (role !== "manage") throw new AccessDenied();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const me = await client.query<{ day: string | null }>("select to_char(day, 'YYYY-MM-DD') as day from mosey_stops where id = $1 for update", [stopId]);
    const day = me.rows[0]?.day;
    if (!day) throw new InputError("Put it on a day first.");
    const { rows } = await client.query<OrderRow>(
      `select id, to_char(at_time, 'HH24:MI') as at_time, time_of_day, meal, to_char(sort_at, 'HH24:MI') as sort_at
         from mosey_stops where trip_id = $1 and day = $2
         order by ${SORT_KEY} nulls last, position, created_at for update`,
      [trip.id, day],
    );
    const i = rows.findIndex((r) => r.id === stopId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length) {
      await client.query("rollback");
      return;
    }
    const [first, second] = direction === "up" ? [rows[i], rows[j]] : [rows[j], rows[i]]; // the new order
    const key = (r: OrderRow) => fixedKey(r) ?? r.sort_at;
    const firstFixed = fixedKey(first);
    const secondFixed = fixedKey(second);
    if (firstFixed !== null && secondFixed !== null && firstFixed !== secondFixed) {
      throw new InputError("Times set the order. Change its time to move it there.");
    }
    // A floating stop takes the time of the one it now sits beside: moving
    // ahead, it takes that stop's place; a floating stop pushed back stays
    // at the time of the stop now ahead of it.
    if (firstFixed === null) first.sort_at = key(second);
    else if (secondFixed === null) second.sort_at = firstFixed;
    const order = [...rows];
    order[Math.min(i, j)] = first;
    order[Math.max(i, j)] = second;
    for (const r of [first, second]) {
      if (fixedKey(r) === null) await client.query("update mosey_stops set sort_at = $2 where id = $1", [r.id, r.sort_at]);
    }
    for (const [k, r] of order.entries()) await client.query("update mosey_stops set position = $2 where id = $1", [r.id, k]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

async function choicesOf(tripId: string): Promise<Record<string, { title: string }>> {
  const { rows } = await pool.query<{ id: string; title: string }>("select id, title from mosey_choices where trip_id = $1", [tripId]);
  return Object.fromEntries(rows.map((r) => [r.id, { title: r.title }]));
}

/** A choice with fewer than two options isn't a choice: let the last one stand alone. */
async function tidyChoices(db: Pick<PoolClient, "query">, tripId: string) {
  await db.query(
    `with thin as (
       select c.id from mosey_choices c where c.trip_id = $1
         and (select count(*) from mosey_stops s where s.choice_id = c.id) < 2)
     delete from mosey_choices where id in (select id from thin)`,
    [tripId],
  );
}

async function dayInfoOf(tripId: string, days: string[]): Promise<Record<string, DayInfo>> {
  const { rows } = await pool.query<{ day: string; area: string; tag: string }>(
    "select to_char(day, 'YYYY-MM-DD') as day, area, tag from mosey_days where trip_id = $1",
    [tripId],
  );
  const out: Record<string, DayInfo> = {};
  // Rows for days the trip no longer covers are kept but not shown.
  for (const r of rows) if (days.includes(r.day)) out[r.day] = { area: r.area, tag: r.tag };
  return out;
}

/** Sets a day's area and tag. Organizers only; both empty clears it. */
export async function setDayInfo(actor: Actor, tripId: string, day: string, input: { area: string; tag: string }): Promise<void> {
  const { trip } = await tripWithRole(actor, tripId, "manage");
  const d = parseDay(day);
  if (!d || !daysBetween(trip.start_date, trip.end_date).includes(d)) throw new InputError("That day isn't part of this trip.");
  const area = cleanText(input.area, 80, "The area");
  const tag = cleanText(input.tag, 40, "The tag");
  if (!area && !tag) {
    await pool.query("delete from mosey_days where trip_id = $1 and day = $2", [trip.id, d]);
    return;
  }
  await pool.query(
    `insert into mosey_days (trip_id, day, area, tag) values ($1, $2, $3, $4)
     on conflict (trip_id, day) do update set area = excluded.area, tag = excluded.tag, updated_at = now()`,
    [trip.id, d, area, tag],
  );
}

export async function getTrip(actor: Actor, id: string): Promise<TripDetail> {
  const { trip, role } = await tripWithRole(actor, id, "view");
  return {
    id: trip.id,
    name: trip.name,
    place: trip.place,
    startDate: trip.start_date,
    endDate: trip.end_date,
    organizer: role === "manage",
    owner: trip.owner_id === actor.id || actor.isAdmin,
    money: canSeeMoney(actor, trip, role),
    guest: actor.guest === true,
    linkJoin: trip.link_join,
    role,
    days: daysBetween(trip.start_date, trip.end_date),
    dayInfo: await dayInfoOf(trip.id, daysBetween(trip.start_date, trip.end_date)),
    choices: await choicesOf(trip.id),
    // Someone with only a view grant sees what a link sees.
    stops: await stopsOf(trip.id, actor.id, !atLeast(role, "contribute")),
    ...(atLeast(role, "contribute") ? await attendanceOf(trip.id, actor.id) : {}),
  };
}

/** The trip's people and who's going to which stop. Members only (callers check). */
async function attendanceOf(tripId: string, viewerId: string) {
  const people = await pool.query<{ id: string; name: string; user_id: string | null }>(
    "select id, name, user_id from mosey_people where trip_id = $1 order by position, created_at",
    [tripId],
  );
  const marks = await pool.query<{ stop_id: string; person_id: string; state: Attending }>(
    `select a.stop_id, a.person_id, a.state from mosey_attendance a
       join mosey_people p on p.id = a.person_id
      where p.trip_id = $1
      order by p.position, p.created_at`,
    [tripId],
  );
  const attendance: Record<string, { personId: string; state: Attending }[]> = {};
  for (const m of marks.rows) (attendance[m.stop_id] ??= []).push({ personId: m.person_id, state: m.state });
  return { people: people.rows.map((r) => ({ id: r.id, name: r.name, me: r.user_id === viewerId })), attendance };
}

/** What a view-only link shows: the plan and ideas, minus members-only details. */
export async function tripByLink(token: string): Promise<TripDetail | null> {
  const link = await resolveShareLink(token);
  if (!link || link.app !== APP || link.type !== "trip") return null;
  const trip = await tripRow(link.id);
  if (!trip) return null;
  return {
    id: trip.id,
    name: trip.name,
    place: trip.place,
    startDate: trip.start_date,
    endDate: trip.end_date,
    organizer: false,
    owner: false,
    money: false,
    guest: false,
    linkJoin: trip.link_join,
    role: "view",
    days: daysBetween(trip.start_date, trip.end_date),
    dayInfo: await dayInfoOf(trip.id, daysBetween(trip.start_date, trip.end_date)),
    choices: await choicesOf(trip.id),
    stops: await stopsOf(trip.id, null, true),
  };
}

// ------------------------------------------------------------ stops

type StopInput = {
  title: string;
  time?: string;
  place?: string;
  link?: string;
  notes?: string;
  membersOnly?: boolean;
  status?: string;
  meal?: string;
  handledBy?: string;
  askWho?: boolean;
};

function cleanMeal(raw: unknown): Meal | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!(MEALS as readonly string[]).includes(s)) throw new InputError("Pick a meal from the list.");
  return s as Meal;
}

function cleanStatus(raw: unknown): Status | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!(STATUSES as readonly string[]).includes(s)) throw new InputError("Pick a status from the list.");
  return s as Status;
}

function readStop(input: StopInput) {
  const title = cleanText(input.title, 200, "A title");
  if (!title) throw new InputError("Say what it is, even just \"Dinner somewhere\".");
  return {
    title,
    when: cleanWhen(input.time),
    place: cleanText(input.place, 200, "The place"),
    link: cleanLink(input.link),
    notes: cleanText(input.notes, 2000, "Notes"),
    membersOnly: input.membersOnly === true,
    status: cleanStatus(input.status),
    meal: cleanMeal(input.meal),
    handledBy: cleanText(input.handledBy, 200, "Who's handling it"),
    askWho: input.askWho === true,
  };
}

/**
 * Adds a stop. Organizers can put it straight on a day. Members add ideas;
 * a day they pick is saved as a suggestion for an organizer to confirm.
 */
export async function addStop(actor: Actor, tripId: string, input: StopInput & { day?: string }): Promise<{ id: string; planned: boolean }> {
  const { trip, role } = await tripWithRole(actor, tripId, "contribute");
  const s = readStop(input);
  let day: string | null = null;
  if (input.day) {
    day = parseDay(input.day);
    if (!day || day < trip.start_date || day > trip.end_date) throw new InputError("Pick a day on the trip.");
  }
  const planned = role === "manage" && day !== null;
  const { rows } = await pool.query<{ id: string }>(
    `insert into mosey_stops (trip_id, day, suggested_day, at_time, title, place, link, notes, members_only, created_by, planned_by, position, time_of_day, status, meal, handled_by, ask_attendance)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       coalesce((select max(position) + 1 from mosey_stops where trip_id = $1), 0), $12, $13, $14, $15, $16)
     returning id`,
    [trip.id, planned ? day : null, planned ? null : day, s.when.time, s.title, s.place, s.link, s.notes, s.membersOnly, actor.id, planned ? actor.id : null, s.when.part, s.status, s.meal, s.handledBy, s.askWho],
  );
  return { id: rows[0].id, planned };
}

async function stopWithTrip(actor: Actor, stopId: string) {
  if (!UUID.test(stopId)) throw new AccessDenied();
  const { rows } = await pool.query<{ trip_id: string; created_by: string | null }>(
    "select trip_id, created_by from mosey_stops where id = $1",
    [stopId],
  );
  if (!rows[0]) throw new AccessDenied();
  const { trip, role } = await tripWithRole(actor, rows[0].trip_id, "contribute");
  return { trip, role, mine: rows[0].created_by === actor.id };
}

/** Edits a stop's details. Organizers, or the member who added it. */
export async function updateStop(actor: Actor, stopId: string, input: StopInput): Promise<void> {
  const { role, mine } = await stopWithTrip(actor, stopId);
  if (role !== "manage" && !mine) throw new AccessDenied();
  const s = readStop(input);
  await pool.query(
    `update mosey_stops set title = $2, at_time = $3, time_of_day = $8, status = $9, meal = $10, handled_by = $11, ask_attendance = $12, place = $4, link = $5, notes = $6, members_only = $7, updated_at = now()
     where id = $1`,
    [stopId, s.title, s.when.time, s.place, s.link, s.notes, s.membersOnly, s.when.part, s.status, s.meal, s.handledBy, s.askWho],
  );
}

/** Puts a stop on a day of the plan, or (day null) back into Ideas. Organizers only. */
export async function planStop(actor: Actor, stopId: string, day: string | null): Promise<void> {
  const { trip, role } = await stopWithTrip(actor, stopId);
  if (role !== "manage") throw new AccessDenied();
  if (day !== null) {
    const d = parseDay(day);
    if (!d || d < trip.start_date || d > trip.end_date) throw new InputError("Pick a day on the trip.");
    day = d;
  }
  await pool.query(
    `update mosey_stops set day = $2, suggested_day = null, planned_by = $3, updated_at = now(),
       choice_id = case when day is not distinct from $2::date then choice_id else null end
     where id = $1`,
    [stopId, day, day ? actor.id : null],
  );
  await tidyChoices(pool, trip.id);
}

// ------------------------------------------------------------ choices

/**
 * Adds a choice to a day: a title ("Monday afternoon") and two or more
 * options, each a stop on that day that asks who's going. Organizers only.
 */
export async function createChoice(actor: Actor, tripId: string, input: { day: string; title: string; options: string[]; time?: string }): Promise<string> {
  const { trip } = await tripWithRole(actor, tripId, "manage");
  const day = parseDay(input.day);
  if (!day || day < trip.start_date || day > trip.end_date) throw new InputError("Pick a day on the trip.");
  const title = cleanText(input.title, 80, "What's being decided");
  if (!title) throw new InputError("Say what's being decided, like \"Monday afternoon\".");
  const options = input.options.map((o) => cleanText(o, 200, "An option")).filter(Boolean);
  if (options.length < 2) throw new InputError("Add at least two options.");
  if (options.length > 8) throw new InputError("Eight options at most.");
  const when = cleanWhen(input.time);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ id: string }>("insert into mosey_choices (trip_id, title, created_by) values ($1, $2, $3) returning id", [
      trip.id,
      title,
      actor.id,
    ]);
    for (const o of options) {
      await client.query(
        `insert into mosey_stops (trip_id, day, title, created_by, planned_by, ask_attendance, choice_id, at_time, time_of_day, position)
         values ($1, $2, $3, $4, $4, true, $5, $6, $7, coalesce((select max(position) + 1 from mosey_stops where trip_id = $1), 0))`,
        [trip.id, day, o, actor.id, rows[0].id, when.time, when.part],
      );
    }
    await client.query("commit");
    return rows[0].id;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Makes a stop one of a choice's options, or takes it out (null). The stop
 * must be on the same day as the other options. Organizers only.
 */
export async function setStopChoice(actor: Actor, stopId: string, choiceId: string | null): Promise<void> {
  const { trip, role } = await stopWithTrip(actor, stopId);
  if (role !== "manage") throw new AccessDenied();
  if (choiceId === null) {
    await pool.query("update mosey_stops set choice_id = null, updated_at = now() where id = $1", [stopId]);
    await tidyChoices(pool, trip.id);
    return;
  }
  if (!UUID.test(choiceId)) throw new AccessDenied();
  const c = await pool.query<{ day: string | null }>(
    `select (select to_char(s.day, 'YYYY-MM-DD') from mosey_stops s where s.choice_id = c.id limit 1) as day
       from mosey_choices c where c.id = $1 and c.trip_id = $2`,
    [choiceId, trip.id],
  );
  if (!c.rows[0]) throw new AccessDenied();
  const stop = await pool.query<{ day: string | null }>("select to_char(day, 'YYYY-MM-DD') as day from mosey_stops where id = $1", [stopId]);
  if (!stop.rows[0].day || stop.rows[0].day !== c.rows[0].day) throw new InputError("Options in a choice are on the same day. Put it on that day first.");
  await pool.query("update mosey_stops set choice_id = $2, ask_attendance = true, updated_at = now() where id = $1", [stopId, choiceId]);
}

/** Ungroups a choice: its options stay as stops, picks and all. Organizers only. */
export async function ungroupChoice(actor: Actor, tripId: string, choiceId: string): Promise<void> {
  const { trip } = await tripWithRole(actor, tripId, "manage");
  if (!UUID.test(choiceId)) throw new AccessDenied();
  const gone = await pool.query("delete from mosey_choices where id = $1 and trip_id = $2", [choiceId, trip.id]);
  if (!gone.rowCount) throw new AccessDenied();
}

/**
 * Marks someone going, maybe, or neither (null) for a stop or idea. Organizers
 * can mark anyone on the trip's people list; a member only the person linked
 * to their own account.
 */
export async function setAttendance(actor: Actor, stopId: string, personId: string, state: Attending | null): Promise<void> {
  const { trip, role } = await stopWithTrip(actor, stopId);
  if (!UUID.test(personId)) throw new AccessDenied();
  const asks = await pool.query<{ ask_attendance: boolean; choice_id: string | null }>("select ask_attendance, choice_id from mosey_stops where id = $1", [stopId]);
  if (state !== null && !asks.rows[0]?.ask_attendance) throw new InputError("Turn on \"Ask who's going\" for this stop first.");
  const choice = asks.rows[0]?.choice_id ?? null;
  if (choice && state === "maybe") throw new InputError("For options, pick one.");
  if (state !== null && state !== "going" && state !== "maybe") throw new InputError("Pick going or maybe.");
  const { rows } = await pool.query<{ user_id: string | null }>("select user_id from mosey_people where id = $1 and trip_id = $2", [personId, trip.id]);
  if (!rows[0]) throw new AccessDenied();
  if (role !== "manage" && rows[0].user_id !== actor.id) throw new AccessDenied();
  if (state === null) {
    await pool.query("delete from mosey_attendance where stop_id = $1 and person_id = $2", [stopId, personId]);
    return;
  }
  // One pick per person in a choice: picking this option drops their others.
  if (choice) {
    await pool.query(
      "delete from mosey_attendance where person_id = $1 and stop_id in (select id from mosey_stops where choice_id = $2 and id <> $3)",
      [personId, choice, stopId],
    );
  }
  await pool.query(
    `insert into mosey_attendance (stop_id, person_id, state, updated_by) values ($1, $2, $3, $4)
     on conflict (stop_id, person_id) do update set state = excluded.state, updated_by = excluded.updated_by, updated_at = now()`,
    [stopId, personId, state, actor.id],
  );
}

/** Deletes a stop. Organizers, or the member who added it (ideas only once planned). */
export async function deleteStop(actor: Actor, stopId: string): Promise<void> {
  const { role, mine } = await stopWithTrip(actor, stopId);
  if (role !== "manage") {
    const { rows } = await pool.query<{ day: string | null }>("select day from mosey_stops where id = $1", [stopId]);
    if (!mine || rows[0]?.day) throw new AccessDenied();
  }
  const trip = await pool.query<{ trip_id: string }>("delete from mosey_stops where id = $1 returning trip_id", [stopId]);
  if (trip.rows[0]) await tidyChoices(pool, trip.rows[0].trip_id);
}

// ------------------------------------------------------------ people and links

export type TripSharing = {
  /** Members (contribute). Co-organizers are listed separately. */
  members: { kind: "group" | "person"; id: string; name: string }[];
  /** People who can organize the trip with the owner (manage). */
  organizers: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  people: { id: string; name: string }[];
  links: { id: string; token: string }[];
  /** What the trip link allows: join and edit, and Money for those who joined. */
  linkJoin: boolean;
  linkMoney: boolean;
  /** Guests who joined by the link, each with their own link. */
  joiners: Joiner[];
};

export type Joiner = { id: string; name: string; joinedAt: Date };

/** Guest accounts among these ids. */
export async function guestIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { rows } = await pool.query<{ id: string }>(`select id from "user" where id = any($1::text[]) and "isGuest"`, [ids]);
  return new Set(rows.map((r) => r.id));
}

/** People an organizer may add: everyone in their groups (admins: everyone). */
/**
 * Gyfte's sample family (made-up people at @sample.invalid and their group)
 * is for trying Gyfte. It never appears in Mosey's sharing lists and can't
 * be added to a trip.
 */
async function moseyGroups(actor: Actor) {
  const sample = await pool.query<{ access_group_id: string }>("select access_group_id from gyfte_groups where is_sample");
  const hidden = new Set(sample.rows.map((r) => r.access_group_id));
  return (await groupsFor(actor)).filter((g) => !hidden.has(g.id));
}

async function addablePeople(actor: Actor, ownerId: string) {
  const { rows } = await pool.query<{ id: string; name: string; email: string }>(
    actor.isAdmin
      ? `select id, name, email from "user" where id <> $1 and not "isGuest" order by lower(coalesce(nullif(name, ''), email))`
      : `select distinct u.id, u.name, u.email from "user" u
         join group_members m on m.user_id = u.id
         where m.group_id in (select group_id from group_members where user_id = $1) and u.id <> $1 and not u."isGuest"
         order by 1`,
    [actor.id],
  );
  return rows
    .filter((r) => r.id !== ownerId && !r.email.toLowerCase().endsWith("@sample.invalid"))
    .map((r) => ({ id: r.id, name: r.name?.trim() || r.email.split("@")[0] }));
}

export async function tripSharing(actor: Actor, tripId: string): Promise<TripSharing> {
  const { trip } = await ownerOnly(actor, tripId);
  const r = ref(trip);
  const people = await addablePeople(actor, trip.owner_id);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const all = await listItemGrants(actor, r);
  const guests = await guestIds(all.filter((g) => g.userId).map((g) => g.userId!));
  // Guests are listed under the trip link (Joined by link), not here.
  const grants = all.filter((g) => g.role !== "manage" && !(g.userId && guests.has(g.userId)));
  const joiners = await pool.query<Joiner>(
    `select u.id, coalesce(p.name, u.name) as name, l.created_at as "joinedAt"
       from mosey_guest_links l
       join "user" u on u.id = l.user_id
       left join mosey_people p on p.trip_id = l.trip_id and p.user_id = l.user_id
      where l.trip_id = $1 and l.revoked_at is null
      order by l.created_at`,
    [trip.id],
  );
  return {
    linkJoin: trip.link_join,
    linkMoney: trip.link_money,
    joiners: joiners.rows,
    organizers: all.filter((g) => g.role === "manage" && g.userId).map((g) => ({ id: g.userId!, name: names.get(g.userId!) ?? (g.email ?? "").split("@")[0] })),
    members: grants.map((g) =>
      g.groupId
        ? { kind: "group" as const, id: g.groupId, name: g.groupName ?? "Group" }
        : { kind: "person" as const, id: g.userId!, name: names.get(g.userId!) ?? (g.email ?? "").split("@")[0] },
    ),
    groups: await moseyGroups(actor),
    people,
    links: (await listShareLinks(actor, r)).map((l) => ({ id: l.id, token: l.token })),
  };
}

/** Sets exactly who's on the trip as a member (groups and people). */
export async function setTripMembers(actor: Actor, tripId: string, input: { groupIds: string[]; userIds: string[] }): Promise<void> {
  const { trip } = await ownerOnly(actor, tripId);
  const allowedGroups = new Set((await moseyGroups(actor)).map((g) => g.id));
  const allowedPeople = new Set((await addablePeople(actor, trip.owner_id)).map((p) => p.id));
  const groupIds = [...new Set(input.groupIds)];
  const userIds = [...new Set(input.userIds)];
  for (const id of groupIds) if (!allowedGroups.has(id)) throw new InputError("You can only add your own groups.");
  for (const id of userIds) if (!allowedPeople.has(id)) throw new InputError("You can only add people in your groups.");
  const r = ref(trip);
  const current = await listItemGrants(actor, r);
  const guests = await guestIds(current.filter((g) => g.userId).map((g) => g.userId!));
  for (const g of current) {
    if (g.role === "manage") continue; // co-organizers are set on their own
    if (g.userId && guests.has(g.userId)) continue; // joined by link: turned off on their own
    const keep = g.groupId ? groupIds.includes(g.groupId) : userIds.includes(g.userId!);
    if (!keep) await revokeItem(actor, r, g.groupId ? { groupId: g.groupId } : { userId: g.userId! });
  }
  for (const id of groupIds) await grantItem(actor, r, { groupId: id }, "contribute");
  const organizers = new Set((await listItemGrants(actor, r)).filter((g) => g.role === "manage" && g.userId).map((g) => g.userId!));
  for (const id of userIds) if (!organizers.has(id)) await grantItem(actor, r, { userId: id }, "contribute");
}
/**
 * Co-organizers: people who can do everything on the trip that its owner can
 * (plan, ideas, options, people, money, settle-up, details), except share it
 * or delete it. The owner (or an admin) sets them. Never groups.
 */
export async function setTripOrganizers(actor: Actor, tripId: string, userIds: string[]): Promise<void> {
  const { trip } = await ownerOnly(actor, tripId);
  const allowed = new Set((await addablePeople(actor, trip.owner_id)).map((p) => p.id));
  const ids = [...new Set(userIds)];
  for (const id of ids) if (!allowed.has(id)) throw new InputError("You can only add people in your groups.");
  const r = ref(trip);
  for (const g of await listItemGrants(actor, r)) {
    if (g.role === "manage" && g.userId && !ids.includes(g.userId)) await revokeItem(actor, r, { userId: g.userId });
  }
  for (const id of ids) await grantItem(actor, r, { userId: id }, "manage");
}


export async function createTripLink(actor: Actor, tripId: string): Promise<void> {
  const { trip } = await ownerOnly(actor, tripId);
  await createShareLink(actor, ref(trip), { role: "view" });
}

export async function revokeTripLink(actor: Actor, tripId: string, linkId: string): Promise<void> {
  const { trip } = await ownerOnly(actor, tripId);
  await revokeShareLink(actor, ref(trip), linkId);
}

/** A new trip link in place of the old one, which stops working. Guests' own links keep working. */
export async function replaceTripLink(actor: Actor, tripId: string): Promise<void> {
  const { trip } = await ownerOnly(actor, tripId);
  const r = ref(trip);
  for (const l of await listShareLinks(actor, r)) await revokeShareLink(actor, r, l.id);
  await createShareLink(actor, r, { role: "view" });
}
