import "server-only";
import { pool } from "../db";
import { InputError } from "../errors";
import { AccessDenied, grantItem, type Actor } from "../access";
import { isoDay, isPast } from "./occasions";

/**
 * Kids: people in Gyfte without accounts. Each has one or more parents,
 * and every parent can manage the kid's lists (the list's owner is the
 * parent who started it; the others get "Can edit" on it). Parents see
 * claims on kids' lists, as with any list not for themselves.
 *
 * A list is for one kid, or for siblings together (a joint list), so a
 * shared gift exists once and can only be claimed once.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new InputError("Add the kid's name.");
  if (name.length > 80) throw new InputError("Names are at most 80 characters.");
  return name;
}

async function isParent(userId: string, kidId: string): Promise<boolean> {
  if (!UUID.test(kidId)) return false;
  const { rowCount } = await pool.query("select 1 from gyfte_kid_parents where kid_id = $1 and user_id = $2", [kidId, userId]);
  return (rowCount ?? 0) > 0;
}

async function groupAccessIdForMember(actor: Actor, groupId: string): Promise<string> {
  if (!UUID.test(groupId)) throw new AccessDenied();
  const { rows } = await pool.query<{ access_group_id: string }>(
    `select g.access_group_id from gyfte_groups g
     join group_members m on m.group_id = g.access_group_id and m.user_id = $2
     where g.id = $1`,
    [groupId, actor.id],
  );
  if (!rows[0]) throw new AccessDenied();
  return rows[0].access_group_id;
}

/** Adds your kid. You're their first parent; the group is where they'll show up. */
export async function addKid(actor: Actor, groupId: string, name: string): Promise<string> {
  await groupAccessIdForMember(actor, groupId);
  const { rows } = await pool.query<{ id: string }>(
    "insert into gyfte_kids (name, created_by) values ($1, $2) returning id",
    [cleanName(name), actor.id],
  );
  await pool.query("insert into gyfte_kid_parents (kid_id, user_id) values ($1, $2)", [rows[0].id, actor.id]);
  return rows[0].id;
}

export async function renameKid(actor: Actor, kidId: string, name: string): Promise<void> {
  if (!(await isParent(actor.id, kidId))) throw new AccessDenied();
  await pool.query("update gyfte_kids set name = $2 where id = $1", [kidId, cleanName(name)]);
}

/**
 * Adds another parent (someone in one of your groups). They can then manage
 * all of the kid's lists, including ones made before they were added.
 */
export async function addKidParent(actor: Actor, kidId: string, userId: string): Promise<void> {
  if (!(await isParent(actor.id, kidId))) throw new AccessDenied();
  const { rowCount } = await pool.query(
    `select 1 from gyfte_groups g
     join group_members a on a.group_id = g.access_group_id and a.user_id = $1
     join group_members b on b.group_id = g.access_group_id and b.user_id = $2
     limit 1`,
    [actor.id, userId],
  );
  if (!rowCount) throw new InputError("You can only add someone from one of your groups.");
  await pool.query("insert into gyfte_kid_parents (kid_id, user_id) values ($1, $2) on conflict do nothing", [kidId, userId]);
  const lists = await pool.query<{ list_id: string; owner_id: string }>(
    `select lk.list_id, l.owner_id from gyfte_list_kids lk join gyfte_lists l on l.id = lk.list_id where lk.kid_id = $1`,
    [kidId],
  );
  for (const l of lists.rows) {
    if (l.owner_id === userId) continue;
    await pool.query(
      `insert into item_grants (app, item_type, item_id, user_id, role, created_by)
       values ('gyfte', 'list', $1, $2, 'manage', $3)
       on conflict (app, item_type, item_id, user_id) where user_id is not null do update set role = 'manage'`,
      [l.list_id, userId, actor.id],
    );
  }
}

/**
 * Ties a new list to kids and gives each of their other parents "Can edit".
 * Called right after creating the list, by its owner.
 */
export async function linkListToKids(owner: Actor, listId: string, kidIds: string[]): Promise<void> {
  for (const kidId of kidIds) {
    await pool.query("insert into gyfte_list_kids (list_id, kid_id) values ($1, $2) on conflict do nothing", [listId, kidId]);
  }
  const parents = await pool.query<{ user_id: string }>(
    "select distinct user_id from gyfte_kid_parents where kid_id = any($1::uuid[]) and user_id <> $2",
    [kidIds, owner.id],
  );
  for (const p of parents.rows) {
    await grantItem(owner, { app: "gyfte", type: "list", id: listId, ownerId: owner.id }, { userId: p.user_id }, "manage");
  }
}

/**
 * A kid's Christmas list for a year in a group, or a joint list for several
 * of your kids. You must be a parent of every kid and in the group. Returns
 * the existing list if there already is one for exactly those kids.
 */
export async function startKidList(actor: Actor, groupId: string, kidIds: string[], year: string): Promise<string> {
  const accessGroupId = await groupAccessIdForMember(actor, groupId);
  const kids = [...new Set(kidIds)].filter((id) => UUID.test(id));
  if (kids.length === 0) throw new InputError("Pick at least one kid.");
  for (const id of kids) if (!(await isParent(actor.id, id))) throw new AccessDenied();
  if (!/^\d{4}$/.test(year)) throw new InputError("Pick a year.");
  const date = `${year}-12-25`;
  if (isPast(date, isoDay(new Date()))) throw new InputError("That Christmas is in History. Start this year's list instead.");

  const key = [...kids].sort().join(",");
  const existing = await pool.query<{ id: string }>(
    `select l.id from gyfte_lists l
     where l.occasion = 'christmas' and l.occasion_date = $1
       and (select string_agg(kid_id::text, ',' order by kid_id) from gyfte_list_kids where list_id = l.id) = $2
     limit 1`,
    [date, key],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const names = await pool.query<{ name: string }>(
    "select name from gyfte_kids where id = any($1::uuid[]) order by name",
    [kids],
  );
  const recipient = names.rows.map((r) => r.name).join(" & ").slice(0, 80);
  const { rows } = await pool.query<{ id: string }>(
    `insert into gyfte_lists (owner_id, recipient_user_id, recipient_name, occasion, occasion_date, group_id)
     values ($1, null, $2, 'christmas', $3, $4) returning id`,
    [actor.id, recipient, date, groupId],
  );
  const listId = rows[0].id;
  await grantItem(actor, { app: "gyfte", type: "list", id: listId, ownerId: actor.id }, { groupId: accessGroupId }, "contribute");
  await linkListToKids(actor, listId, kids);
  return listId;
}

export type Kid = { id: string; name: string; parentIds: string[] };

/**
 * Kids with at least one parent in the given warbag group: your kids show
 * in every group you're in. A sample group shows only its made-up kids, so
 * real kids never appear among sample people.
 */
export async function kidsOfMembers(accessGroupId: string, sampleOnly = false): Promise<Kid[]> {
  const { rows } = await pool.query<Kid>(
    `select k.id, k.name, array_agg(p.user_id order by p.added_at) as "parentIds"
     from gyfte_kids k join gyfte_kid_parents p on p.kid_id = k.id
     where k.id in (select kp.kid_id from gyfte_kid_parents kp
                    join group_members m on m.user_id = kp.user_id and m.group_id = $1
                    where not $2 or kp.user_id in (select user_id from sample_people))
     group by k.id order by lower(k.name)`,
    [accessGroupId, sampleOnly],
  );
  return rows;
}

/** Kids you're a parent of. */
export async function myKids(actor: Actor): Promise<{ id: string; name: string; parents: { id: string; name: string }[] }[]> {
  const { rows } = await pool.query(
    `select k.id, k.name,
       json_agg(json_build_object('id', u.id, 'name', coalesce(nullif(u.name, ''), split_part(u.email, '@', 1))) order by p.added_at) as parents
     from gyfte_kids k
     join gyfte_kid_parents p on p.kid_id = k.id
     join "user" u on u.id = p.user_id
     where k.id in (select kid_id from gyfte_kid_parents where user_id = $1)
     group by k.id order by lower(k.name)`,
    [actor.id],
  );
  return rows;
}

/** The kids a list is for (empty for adults' lists). */
export async function kidsOfList(listId: string): Promise<string[]> {
  const { rows } = await pool.query<{ kid_id: string }>("select kid_id from gyfte_list_kids where list_id = $1 order by kid_id", [
    listId,
  ]);
  return rows.map((r) => r.kid_id);
}
