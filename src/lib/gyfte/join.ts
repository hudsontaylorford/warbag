import "server-only";
import { pool } from "../db";
import { InputError } from "../errors";
import { AccessDenied, addToGroup, audit, requireAdmin, type Actor } from "../access";
import { invitePerson, normalizeEmail } from "../people";

const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keeps a public form from filling the admin's queue. */
export const JOIN_LIMIT = { pendingPerGroup: 25, perGroupPerHour: 10 };

export type JoinRequest = { id: string; name: string; email: string; createdAt: Date };

/**
 * "Ask to join" on a family link. Anyone with the link may ask; nothing is
 * created until an admin approves. The reply is the same whether or not the
 * email already has an account or a pending request, so the form reveals
 * nothing about who is on warbag.
 */
export async function requestToJoin(token: string, input: { name: string; email: string }): Promise<void> {
  if (!TOKEN.test(token)) throw new InputError("This family link isn't working anymore. Ask for a new one.");
  const { rows } = await pool.query<{ id: string }>(
    "select id from gyfte_groups where invite_token = $1 and not is_sample",
    [token],
  );
  const group = rows[0];
  if (!group) throw new InputError("This family link isn't working anymore. Ask for a new one.");

  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new InputError("Enter your name.");
  if (name.length > 80) throw new InputError("Names are at most 80 characters.");
  const email = normalizeEmail(input.email);

  const { rows: counts } = await pool.query<{ pending: number; recent: number }>(
    `select count(*)::int as pending,
            count(*) filter (where created_at > now() - interval '1 hour')::int as recent
     from gyfte_join_requests where group_id = $1`,
    [group.id],
  );
  if (counts[0].pending >= JOIN_LIMIT.pendingPerGroup || counts[0].recent >= JOIN_LIMIT.perGroupPerHour) {
    throw new InputError("Lots of requests right now. Try again in an hour.");
  }

  // A repeat request just refreshes the name; the reply doesn't change.
  await pool.query(
    `insert into gyfte_join_requests (group_id, name, email) values ($1, $2, $3)
     on conflict (group_id, email) do update set name = excluded.name`,
    [group.id, name, email],
  );
}

/** Pending requests for a group. Admins in the group only. */
export async function joinRequests(actor: Actor, groupId: string): Promise<JoinRequest[]> {
  requireAdmin(actor);
  if (!UUID.test(groupId)) return [];
  const { rows } = await pool.query<JoinRequest>(
    `select r.id, r.name, r.email, r.created_at as "createdAt"
     from gyfte_join_requests r
     join gyfte_groups g on g.id = r.group_id
     join group_members m on m.group_id = g.access_group_id and m.user_id = $2
     where r.group_id = $1
     order by r.created_at asc`,
    [groupId, actor.id],
  );
  return rows;
}

async function requestFor(actor: Actor, requestId: string) {
  requireAdmin(actor);
  if (!UUID.test(requestId)) throw new AccessDenied();
  const { rows } = await pool.query<{ id: string; name: string; email: string; group_id: string; access_group_id: string }>(
    `select r.id, r.name, r.email, r.group_id, g.access_group_id
     from gyfte_join_requests r
     join gyfte_groups g on g.id = r.group_id
     join group_members m on m.group_id = g.access_group_id and m.user_id = $2
     where r.id = $1`,
    [requestId, actor.id],
  );
  if (!rows[0]) throw new AccessDenied();
  return rows[0];
}

/**
 * Approve: adds them to warbag (or finds their existing account) and to
 * this group. No email is sent; they come back to the family link and tap
 * "This is me", which emails them a sign-in link.
 */
export async function approveJoinRequest(actor: Actor, requestId: string): Promise<{ name: string }> {
  const req = await requestFor(actor, requestId);
  const { id: userId } = await invitePerson(actor, { email: req.email, name: req.name, sendEmail: false });
  await addToGroup(actor, req.access_group_id, userId);
  await pool.query("delete from gyfte_join_requests where id = $1", [req.id]);
  await audit(pool, actor.id, "gyfte.join.approve", `gyfte/group/${req.group_id}`, { userId });
  return { name: req.name };
}

/** Decline: the request is deleted. Nothing is sent. */
export async function declineJoinRequest(actor: Actor, requestId: string): Promise<void> {
  const req = await requestFor(actor, requestId);
  await pool.query("delete from gyfte_join_requests where id = $1", [req.id]);
  await audit(pool, actor.id, "gyfte.join.decline", `gyfte/group/${req.group_id}`, {});
}
