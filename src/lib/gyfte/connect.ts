import "server-only";
import { pool } from "../db";
import { InputError } from "../errors";
import { AccessDenied, audit, requireAdmin, type Actor } from "../access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lists filed under a typed name (no account, not a kid), as one entry per name. */
export type NameOnly = { name: string; lists: number; years: string[] };

/** Name-only lists in a group, for organizers to connect. Admins in the group only. */
async function groupForAdmin(actor: Actor, groupId: string) {
  requireAdmin(actor);
  if (!UUID.test(groupId)) throw new AccessDenied();
  const { rows } = await pool.query<{ id: string; access_group_id: string }>(
    `select g.id, g.access_group_id from gyfte_groups g
     join group_members m on m.group_id = g.access_group_id and m.user_id = $2
     where g.id = $1 and not g.is_sample`,
    [groupId, actor.id],
  );
  if (!rows[0]) throw new AccessDenied();
  return rows[0];
}

const NAME_ONLY = `l.recipient_user_id is null
  and not exists (select 1 from gyfte_list_kids k where k.list_id = l.id)`;

export async function nameOnlyLists(actor: Actor, groupId: string): Promise<NameOnly[]> {
  await groupForAdmin(actor, groupId);
  const { rows } = await pool.query<{ name: string; lists: number; years: string[] }>(
    `select min(l.recipient_name) as name, count(*)::int as lists,
       array_agg(distinct to_char(l.occasion_date, 'YYYY') order by to_char(l.occasion_date, 'YYYY')) as years
     from gyfte_lists l
     where l.group_id = $1 and ${NAME_ONLY}
     group by lower(l.recipient_name)
     order by lower(min(l.recipient_name))`,
    [groupId],
  );
  return rows;
}

/**
 * Connects every name-only list for `name` in this group to a member: they
 * become its owner and the person it's for, as if the import had matched
 * them. Claims stay, and are hidden from them like on any list of theirs.
 * Refuses when they already have a list for the same occasion and date,
 * rather than leave two lists for one Christmas.
 */
export async function connectName(actor: Actor, groupId: string, name: string, userId: string): Promise<{ lists: number }> {
  const group = await groupForAdmin(actor, groupId);
  const clean = name.trim();
  if (!clean) throw new InputError("Pick a name to connect.");
  const member = await pool.query<{ name: string; email: string }>(
    `select u.name, u.email from group_members m join "user" u on u.id = m.user_id where m.group_id = $1 and m.user_id = $2`,
    [group.access_group_id, userId],
  );
  if (!member.rows[0]) throw new InputError("Pick someone in this group.");

  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows: lists } = await client.query<{ id: string; occasion: string; d: string }>(
      `select l.id, l.occasion, to_char(l.occasion_date, 'YYYY-MM-DD') as d from gyfte_lists l
       where l.group_id = $1 and lower(l.recipient_name) = lower($2) and ${NAME_ONLY}
       for update`,
      [groupId, clean],
    );
    if (lists.length === 0) throw new InputError("There are no lists under that name anymore.");

    const clash = await client.query<{ d: string }>(
      `select to_char(occasion_date, 'YYYY') as d from gyfte_lists
       where recipient_user_id = $1 and (occasion, occasion_date) in (select occasion, occasion_date from gyfte_lists where id = any($2::uuid[]))
       limit 1`,
      [userId, lists.map((l) => l.id)],
    );
    if (clash.rows[0]) {
      const who = member.rows[0].name || member.rows[0].email;
      throw new InputError(`${who} already has a list for ${clash.rows[0].d}. Delete or move gifts from one of them first.`);
    }

    await client.query(
      `update gyfte_lists set owner_id = $2, recipient_user_id = $2, updated_at = now() where id = any($1::uuid[])`,
      [lists.map((l) => l.id), userId],
    );
    await audit(client, actor.id, "gyfte.lists.connect", `gyfte/group/${groupId}`, { userId, lists: lists.length });
    await client.query("commit");
    return { lists: lists.length };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
