import "server-only";
import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { InputError } from "../errors";
import { AccessDenied, atLeast, audit, itemRole, resolveShareLink, type Actor } from "../access";
import { ownerOnly } from "./trips";

/**
 * Joining a trip from its trip link, like chirk. The owner turns it on per
 * trip (Manage → Trip link). Someone with the link picks their name from
 * the trip's people (or adds it) and becomes a member of that trip:
 *
 * - Not signed in: they get a guest account. No email and no sign-in by
 *   code; this device is signed in, and they get a private link of their
 *   own to come back on another device. Guests never see receipt photos,
 *   and see Money only when the owner puts Money on the link.
 * - Signed in: they join as themselves.
 *
 * A name can be picked once: after that it belongs to whoever picked it.
 * The owner can turn off anyone who joined by link; that removes them from
 * the trip, turns off their own link and signs them out.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;

/** Joins per trip per hour, and people per trip, so a leaked link can't flood a trip. */
export const LINK_JOIN_LIMIT = { perTripPerHour: 20, peoplePerTrip: 80 };

const target = (tripId: string) => `mosey/trip/${tripId}`;

function cleanName(raw: unknown): string {
  const s = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) throw new InputError("Pick your name or type it.");
  if (s.length > 80) throw new InputError("Names are at most 80 characters.");
  return s;
}

type LinkTrip = { id: string; owner_id: string; name: string; link_join: boolean };

async function tripForLink(token: string): Promise<LinkTrip | null> {
  const link = await resolveShareLink(token);
  if (!link || link.app !== "mosey" || link.type !== "trip" || !UUID.test(link.id)) return null;
  const { rows } = await pool.query<LinkTrip>("select id, owner_id, name, link_join from mosey_trips where id = $1", [link.id]);
  return rows[0] ?? null;
}

/**
 * Names on the trip's people list nobody has picked yet (adults only), for
 * "Who are you?". Empty unless the trip link lets people join.
 */
export async function joinableNames(token: string): Promise<{ id: string; name: string }[]> {
  const trip = await tripForLink(token);
  if (!trip?.link_join) return [];
  const { rows } = await pool.query<{ id: string; name: string }>(
    "select id, name from mosey_people where trip_id = $1 and user_id is null and not kid order by position, created_at",
    [trip.id],
  );
  return rows;
}

async function onTrip(actor: Actor, trip: LinkTrip): Promise<boolean> {
  const role = await itemRole(actor, { app: "mosey", type: "trip", id: trip.id, ownerId: trip.owner_id });
  return atLeast(role, "contribute");
}

/** The person this account is on the trip's people list as, if any. */
async function personOf(c: Pick<PoolClient, "query">, tripId: string, userId: string) {
  const { rows } = await c.query<{ id: string; name: string }>("select id, name from mosey_people where trip_id = $1 and user_id = $2", [tripId, userId]);
  return rows[0] ?? null;
}

/**
 * Joins the trip from its link, as the signed-in person or (signed out) as a
 * new guest. Returns the trip, and the guest account to sign this device
 * in as, if one was made.
 */
export async function joinByLink(
  actor: Actor | null,
  token: string,
  input: { personId?: string; name?: string },
): Promise<{ tripId: string; newGuestId: string | null }> {
  const trip = await tripForLink(token);
  if (!trip) throw new InputError("This trip link isn't working anymore. Ask for a new one.");
  if (!trip.link_join) throw new InputError("This trip link doesn't let people join on their own anymore. Ask to join instead.");
  if (actor && (await onTrip(actor, trip))) return { tripId: trip.id, newGuestId: null };

  const c = await pool.connect();
  try {
    await c.query("begin");
    // One join at a time per trip, so two people can't pick the same name.
    await c.query("select 1 from mosey_trips where id = $1 for update", [trip.id]);
    const counts = await c.query<{ recent: number; people: number }>(
      `select (select count(*)::int from mosey_guest_links where trip_id = $1 and created_at > now() - interval '1 hour') as recent,
              (select count(*)::int from mosey_people where trip_id = $1) as people`,
      [trip.id],
    );
    if (counts.rows[0].recent >= LINK_JOIN_LIMIT.perTripPerHour) throw new InputError("Lots of people joined just now. Try again in an hour.");

    // Who they are on the trip's people list.
    const existing = actor ? await personOf(c, trip.id, actor.id) : null;
    let personId: string;
    let name: string;
    if (existing) {
      ({ id: personId, name } = existing);
    } else if (input.personId) {
      if (!UUID.test(input.personId)) throw new AccessDenied();
      const { rows } = await c.query<{ id: string; name: string }>(
        "select id, name from mosey_people where id = $1 and trip_id = $2 and user_id is null and not kid",
        [input.personId, trip.id],
      );
      if (!rows[0]) throw new InputError("Someone already picked that name. Pick another, or type yours.");
      ({ id: personId, name } = rows[0]);
    } else {
      name = cleanName(input.name);
      const same = await c.query<{ user_id: string | null }>("select user_id from mosey_people where trip_id = $1 and lower(name) = lower($2)", [trip.id, name]);
      if (same.rows[0]) {
        throw new InputError(
          same.rows[0].user_id ? `${name} is already on this trip. Use a different name, like adding a last initial.` : `${name} is already on the list. Pick it above.`,
        );
      }
      if (counts.rows[0].people >= LINK_JOIN_LIMIT.peoplePerTrip) throw new InputError("This trip is full. Ask the organizer.");
      const { rows } = await c.query<{ id: string }>(
        `insert into mosey_people (trip_id, name, position) values ($1, $2, coalesce((select max(position) + 1 from mosey_people where trip_id = $1), 0)) returning id`,
        [trip.id, name],
      );
      personId = rows[0].id;
    }

    // Their account: themselves if signed in, else a new guest.
    let userId: string;
    let newGuestId: string | null = null;
    if (actor) {
      userId = actor.id;
    } else {
      userId = randomBytes(16).toString("hex");
      await c.query(
        `insert into "user" (id, name, email, "emailVerified", "isGuest") values ($1, $2, $3, false, true)`,
        [userId, name, `guest-${userId}@guest.invalid`],
      );
      newGuestId = userId;
    }
    if (!existing) await c.query("update mosey_people set user_id = $2 where id = $1", [personId, userId]);
    await c.query(
      `insert into item_grants (app, item_type, item_id, user_id, role, created_by)
       values ('mosey', 'trip', $1, $2, 'contribute', $2)
       on conflict (app, item_type, item_id, user_id) where user_id is not null do nothing`,
      [trip.id, userId],
    );
    if (!actor || actor.guest) {
      await c.query(
        `insert into mosey_guest_links (trip_id, user_id, token) values ($1, $2, $3)
         on conflict (trip_id, user_id) where revoked_at is null do nothing`,
        [trip.id, userId, randomBytes(24).toString("base64url")],
      );
    }
    await audit(c, userId, "mosey.trip.link.join", target(trip.id), { personId, guest: !actor || actor.guest === true });
    await c.query("commit");
    return { tripId: trip.id, newGuestId };
  } catch (err) {
    await c.query("rollback");
    throw err;
  } finally {
    c.release();
  }
}

export type GuestLink = { tripId: string; tripName: string; userId: string; name: string };

/**
 * A guest's own link: whose it is, if it still works (not turned off, still
 * on the trip, still a guest account).
 */
export async function openGuestLink(token: string): Promise<GuestLink | null> {
  if (!TOKEN.test(token)) return null;
  const { rows } = await pool.query<GuestLink>(
    `select l.trip_id as "tripId", t.name as "tripName", l.user_id as "userId", coalesce(p.name, u.name) as name
       from mosey_guest_links l
       join mosey_trips t on t.id = l.trip_id
       join "user" u on u.id = l.user_id and u."isGuest"
       left join mosey_people p on p.trip_id = l.trip_id and p.user_id = l.user_id
      where l.token = $1 and l.revoked_at is null
        and exists (select 1 from item_grants g where g.app = 'mosey' and g.item_type = 'trip'
                      and g.item_id = l.trip_id::text and g.user_id = l.user_id)`,
    [token],
  );
  return rows[0] ?? null;
}

/** A guest's own link for this trip (the token), for "Your link". Guests only. */
export async function myGuestLink(actor: Actor, tripId: string): Promise<string | null> {
  if (!actor.guest || !UUID.test(tripId)) return null;
  const { rows } = await pool.query<{ token: string }>(
    "select token from mosey_guest_links where trip_id = $1 and user_id = $2 and revoked_at is null",
    [tripId, actor.id],
  );
  return rows[0]?.token ?? null;
}

/** What the trip link allows. The trip's owner (or an admin). */
export async function setLinkOptions(actor: Actor, tripId: string, input: { join: boolean; money: boolean }): Promise<void> {
  const { trip } = await ownerOnly(actor, tripId);
  await pool.query("update mosey_trips set link_join = $2, link_money = $3, updated_at = now() where id = $1", [trip.id, input.join, input.money]);
  await audit(pool, actor.id, "mosey.trip.link.options", target(trip.id), { join: input.join, money: input.money });
}

/**
 * Turns off someone who joined by link: off the trip, their own link off,
 * unlinked from their name (so it can be picked again), signed out.
 */
export async function turnOffJoiner(actor: Actor, tripId: string, userId: string): Promise<void> {
  const { trip } = await ownerOnly(actor, tripId);
  const c = await pool.connect();
  try {
    await c.query("begin");
    const { rows } = await c.query<{ id: string }>(
      `select u.id from "user" u where u.id = $1 and u."isGuest"
         and exists (select 1 from mosey_guest_links l where l.trip_id = $2 and l.user_id = u.id)`,
      [userId, trip.id],
    );
    if (!rows[0]) throw new AccessDenied();
    await c.query("update mosey_guest_links set revoked_at = now() where trip_id = $1 and user_id = $2 and revoked_at is null", [trip.id, userId]);
    await c.query("delete from item_grants where app = 'mosey' and item_type = 'trip' and item_id = $1 and user_id = $2", [trip.id, userId]);
    await c.query("update mosey_people set user_id = null where trip_id = $1 and user_id = $2", [trip.id, userId]);
    await c.query(`delete from "session" where "userId" = $1`, [userId]);
    await audit(c, actor.id, "mosey.trip.link.turn-off", target(trip.id), { userId });
    await c.query("commit");
  } catch (err) {
    await c.query("rollback");
    throw err;
  } finally {
    c.release();
  }
}
