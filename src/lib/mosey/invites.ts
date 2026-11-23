import "server-only";
import { pool } from "../db";
import { InputError } from "../errors";
import { AccessDenied, audit, grantItem, resolveShareLink, type Actor } from "../access";
import { invitePerson, normalizeEmail } from "../people";
import { sendEmail } from "../email";
import { siteUrl } from "../site";
import { ownerOnly } from "./trips";

/**
 * Getting people into a trip, in one step: invite by email (owner, who must
 * be able to add people to warbag), or "Ask to join" from the trip link
 * (anyone with it), which the owner adds or declines. Adding someone puts
 * them on warbag if they're new, gives them the trip, and (if asked) emails
 * them how to sign in and where the trip is.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keeps a public form from filling the owner's queue. */
export const TRIP_JOIN_LIMIT = { pendingPerTrip: 25, perTripPerHour: 10 };

export type TripRole = "contribute" | "manage";

function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new InputError("Enter their name.");
  if (name.length > 80) throw new InputError("Names are at most 80 characters.");
  return name;
}

function rangeText(start: string, end: string): string {
  const d = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return start === end ? d(start) : `${d(start)} to ${d(end)}`;
}

export function tripInviteEmail(from: string, trip: { id: string; name: string; start: string; end: string }, email: string) {
  const site = siteUrl();
  return {
    subject: `${from} added you to ${trip.name}`,
    text:
      `${from} added you to the trip "${trip.name}" (${rangeText(trip.start, trip.end)}) on warbag.\n\n` +
      `To see it, go to ${site}/sign-in?next=${encodeURIComponent(`/mosey/${trip.id}`)} and enter ${email}. ` +
      `We'll email you a 6-digit code. No password needed.\n`,
  };
}

async function nameOf(userId: string): Promise<string> {
  const { rows } = await pool.query<{ name: string; email: string }>(`select name, email from "user" where id = $1`, [userId]);
  return rows[0]?.name || rows[0]?.email || "Someone";
}

/** Adds someone (new or already on warbag) to the trip, and emails them if asked. */
async function addToTrip(
  actor: Actor,
  trip: { id: string; owner_id: string; name: string; start_date: string; end_date: string },
  input: { name: string; email: string; role: TripRole; sendEmail: boolean },
) {
  const { id: userId } = await invitePerson(actor, { email: input.email, name: input.name, sendEmail: false });
  if (userId === trip.owner_id) throw new InputError("That's the trip's owner.");
  // An existing co-organizer is never downgraded by a member invite.
  const current = await pool.query<{ role: string }>(
    "select role from item_grants where app = 'mosey' and item_type = 'trip' and item_id = $1 and user_id = $2",
    [trip.id, userId],
  );
  const role = current.rows[0]?.role === "manage" ? "manage" : input.role;
  await grantItem(actor, { app: "mosey", type: "trip", id: trip.id, ownerId: trip.owner_id }, { userId }, role);
  if (input.sendEmail) {
    const from = await nameOf(actor.id);
    await sendEmail({ to: input.email, ...tripInviteEmail(from, { id: trip.id, name: trip.name, start: trip.start_date, end: trip.end_date }, input.email) });
  }
  return userId;
}

/**
 * Invite by email from the trip's Manage. The trip's owner (or an admin),
 * who must also be able to add people to warbag (admin or people manager).
 */
export async function inviteToTrip(
  actor: Actor,
  tripId: string,
  input: { name: string; email: string; role: string; sendEmail: boolean },
): Promise<{ emailed: boolean }> {
  const { trip } = await ownerOnly(actor, tripId);
  if (!actor.isAdmin && !actor.peopleManager) throw new AccessDenied("Only admins and people managers can add new people");
  const role: TripRole = input.role === "manage" ? "manage" : "contribute";
  const name = cleanName(input.name);
  const email = normalizeEmail(input.email);
  await addToTrip(actor, trip, { name, email, role, sendEmail: input.sendEmail });
  await audit(pool, actor.id, "mosey.trip.invite", `mosey/trip/${trip.id}`, { email, role });
  return { emailed: input.sendEmail };
}

/**
 * "Ask to join" on a trip link. Anyone with the link may ask; nothing is
 * created until the owner adds them. The reply is the same whether or not
 * the email is on warbag or already asked, so the form reveals nothing.
 */
export async function requestToJoinTrip(token: string, input: { name: string; email: string }): Promise<void> {
  const link = await resolveShareLink(token);
  if (!link || link.app !== "mosey" || link.type !== "trip") throw new InputError("This trip link isn't working anymore. Ask for a new one.");
  const name = cleanName(input.name);
  const email = normalizeEmail(input.email);
  const { rows } = await pool.query<{ pending: number; recent: number }>(
    `select count(*)::int as pending,
            count(*) filter (where created_at > now() - interval '1 hour')::int as recent
     from mosey_join_requests where trip_id = $1`,
    [link.id],
  );
  if (rows[0].pending >= TRIP_JOIN_LIMIT.pendingPerTrip || rows[0].recent >= TRIP_JOIN_LIMIT.perTripPerHour) {
    throw new InputError("Lots of requests right now. Try again in an hour.");
  }
  await pool.query(
    `insert into mosey_join_requests (trip_id, name, email) values ($1, $2, $3)
     on conflict (trip_id, email) do update set name = excluded.name`,
    [link.id, name, email],
  );
}

export type TripJoinRequest = { id: string; name: string; email: string; createdAt: Date };

/** Who's asking to join. The trip's owner (or an admin). */
export async function tripJoinRequests(actor: Actor, tripId: string): Promise<TripJoinRequest[]> {
  const { trip } = await ownerOnly(actor, tripId);
  const { rows } = await pool.query<TripJoinRequest>(
    `select id, name, email, created_at as "createdAt" from mosey_join_requests where trip_id = $1 order by created_at`,
    [trip.id],
  );
  return rows;
}

async function requestFor(actor: Actor, requestId: string) {
  if (!UUID.test(requestId)) throw new AccessDenied();
  const { rows } = await pool.query<{ id: string; trip_id: string; name: string; email: string }>(
    "select id, trip_id, name, email from mosey_join_requests where id = $1",
    [requestId],
  );
  if (!rows[0]) throw new AccessDenied();
  const { trip } = await ownerOnly(actor, rows[0].trip_id);
  return { req: rows[0], trip };
}

/** Add: puts them on warbag and the trip as a member, and emails them how to sign in. */
export async function approveTripJoin(actor: Actor, requestId: string): Promise<{ name: string }> {
  const { req, trip } = await requestFor(actor, requestId);
  if (!actor.isAdmin && !actor.peopleManager) throw new AccessDenied("Only admins and people managers can add new people");
  await addToTrip(actor, trip, { name: req.name, email: req.email, role: "contribute", sendEmail: true });
  await pool.query("delete from mosey_join_requests where id = $1", [req.id]);
  await audit(pool, actor.id, "mosey.trip.join.approve", `mosey/trip/${trip.id}`, { email: req.email });
  return { name: req.name };
}

/** Decline: the request is deleted. Nothing is sent. */
export async function declineTripJoin(actor: Actor, requestId: string): Promise<void> {
  const { req, trip } = await requestFor(actor, requestId);
  await pool.query("delete from mosey_join_requests where id = $1", [req.id]);
  await audit(pool, actor.id, "mosey.trip.join.decline", `mosey/trip/${trip.id}`, {});
}
