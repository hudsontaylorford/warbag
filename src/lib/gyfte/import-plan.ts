import "server-only";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { InputError } from "../errors";
import { AccessDenied, type Actor } from "../access";
import type { ImportedItem, SheetImport } from "./sheet-import";

/**
 * How a reviewed spreadsheet becomes lists. For each tab (person):
 *   me       your own lists
 *   member   a member of the chosen group (their history becomes theirs)
 *   kid      a kid of a parent in the group (found by name, or created)
 *   split    a tab for several kids: each row goes to one kid or to all of
 *            them together (a joint list); unticked rows are skipped
 *   name     just a name, managed by you (the old behavior)
 *   skip     nothing from this tab
 * With a group, lists are filed there and shared with it. Lists that
 * already exist for that person and Christmas are skipped, so applying
 * twice can't duplicate anything.
 */

export type TabPlan =
  | { who: "me" }
  | { who: "member"; userId: string }
  | { who: "kid"; parentId: string; kidName: string }
  | { who: "split"; parentId: string; kids: string[]; rows: Record<string, string> }
  | { who: "name" }
  | { who: "skip" };

export type ImportPlan = { groupId: string | null; tabs: Record<string, TabPlan>; keep: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanName(raw: unknown, what: string): string {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) throw new InputError(`${what} needs a name (up to 80 characters).`);
  return name;
}

/** Group the importer is in, and its members, or none. */
async function targetGroup(actor: Actor, groupId: string | null) {
  if (!groupId) return null;
  if (!UUID.test(groupId)) throw new AccessDenied();
  const { rows } = await pool.query<{ id: string; access_group_id: string }>(
    `select g.id, g.access_group_id from gyfte_groups g
     join group_members m on m.group_id = g.access_group_id and m.user_id = $2
     where g.id = $1 and not g.is_sample`,
    [groupId, actor.id],
  );
  if (!rows[0]) throw new AccessDenied();
  const members = await pool.query<{ user_id: string }>("select user_id from group_members where group_id = $1", [
    rows[0].access_group_id,
  ]);
  return { ...rows[0], members: new Set(members.rows.map((m) => m.user_id)) };
}

/** Checks every choice before anything is written. */
export async function validatePlan(actor: Actor, sheet: SheetImport, plan: ImportPlan) {
  const group = await targetGroup(actor, plan.groupId);
  const inGroup = (id: string) => (group ? group.members.has(id) : id === actor.id);
  const people = new Set(sheet.lists.map((l) => l.person));
  const tabs: Record<string, TabPlan> = {};
  for (const person of people) {
    const raw = ((plan.tabs ?? {})[person] ?? { who: "name" }) as TabPlan;
    if (typeof raw !== "object") throw new InputError(`${person}: pick who this is.`);
    switch (raw.who) {
      case "me":
      case "name":
      case "skip":
        tabs[person] = { who: raw.who };
        break;
      case "member":
        if (!group || !UUID.test(raw.userId) || !inGroup(raw.userId)) throw new InputError(`${person}: pick someone in the group.`);
        tabs[person] = { who: "member", userId: raw.userId };
        break;
      case "kid":
        if (!inGroup(raw.parentId)) throw new InputError(`${person}: pick a parent in the group.`);
        tabs[person] = { who: "kid", parentId: raw.parentId, kidName: cleanName(raw.kidName, person) };
        break;
      case "split": {
        if (!inGroup(raw.parentId)) throw new InputError(`${person}: pick a parent in the group.`);
        const kids = [...new Set((raw.kids ?? []).map((k) => cleanName(k, person)))];
        if (kids.length < 2 || kids.length > 6) throw new InputError(`${person}: name 2 to 6 kids to split between.`);
        const rows: Record<string, string> = {};
        for (const [key, to] of Object.entries(raw.rows ?? {})) {
          if (to === "both" || kids.includes(to)) rows[key] = to;
        }
        tabs[person] = { who: "split", parentId: raw.parentId, kids, rows };
        break;
      }
      default:
        throw new InputError(`${person}: pick who this is.`);
    }
  }
  return { group, tabs, keep: new Set(plan.keep) };
}

async function kidFor(client: PoolClient, parentId: string, name: string, createdBy: string): Promise<string> {
  const found = await client.query<{ id: string }>(
    `select k.id from gyfte_kids k join gyfte_kid_parents p on p.kid_id = k.id
     where p.user_id = $1 and lower(k.name) = lower($2) order by k.created_at limit 1`,
    [parentId, name],
  );
  if (found.rows[0]) return found.rows[0].id;
  const made = await client.query<{ id: string }>("insert into gyfte_kids (name, created_by) values ($1, $2) returning id", [
    name,
    createdBy,
  ]);
  await client.query("insert into gyfte_kid_parents (kid_id, user_id) values ($1, $2)", [made.rows[0].id, parentId]);
  return made.rows[0].id;
}

type Target = { ownerId: string; recipientUserId: string | null; recipientName: string; kidIds: string[] };

async function alreadyThere(client: PoolClient, actor: Actor, t: Target, date: string): Promise<boolean> {
  const key = [...t.kidIds].sort().join(",");
  const { rowCount } = await client.query(
    `select 1 from gyfte_lists l
     where l.occasion = 'christmas' and l.occasion_date = $1
       and (case
         when $2::text <> '' then (select string_agg(kid_id::text, ',' order by kid_id) from gyfte_list_kids where list_id = l.id) = $2
         when $3::text is not null then l.recipient_user_id = $3
         else l.recipient_user_id is null and l.owner_id = $4 and lower(l.recipient_name) = lower($5)
           and not exists (select 1 from gyfte_list_kids where list_id = l.id)
       end)
     limit 1`,
    [date, key, t.recipientUserId, t.ownerId, t.recipientName],
  );
  return (rowCount ?? 0) > 0;
}

async function writeList(
  client: PoolClient,
  actor: Actor,
  group: { id: string; access_group_id: string } | null,
  t: Target,
  year: number,
  items: ImportedItem[],
): Promise<boolean> {
  const date = `${year}-12-25`;
  if (items.length === 0 || (await alreadyThere(client, actor, t, date))) return false;
  const { rows } = await client.query<{ id: string }>(
    `insert into gyfte_lists (owner_id, recipient_user_id, recipient_name, occasion, occasion_date, group_id)
     values ($1, $2, $3, 'christmas', $4, $5) returning id`,
    [t.ownerId, t.recipientUserId, t.recipientName.slice(0, 80), date, group?.id ?? null],
  );
  const listId = rows[0].id;
  if (group) {
    await client.query(
      `insert into item_grants (app, item_type, item_id, group_id, role, created_by) values ('gyfte', 'list', $1, $2, 'contribute', $3)`,
      [listId, group.access_group_id, actor.id],
    );
  }
  for (const kidId of t.kidIds) {
    await client.query("insert into gyfte_list_kids (list_id, kid_id) values ($1, $2)", [listId, kidId]);
  }
  if (t.kidIds.length) {
    // Every other parent of these kids can edit, as with lists made in the app.
    await client.query(
      `insert into item_grants (app, item_type, item_id, user_id, role, created_by)
       select distinct 'gyfte', 'list', $1, p.user_id, 'manage', $3
       from gyfte_kid_parents p where p.kid_id = any($2::uuid[]) and p.user_id <> $4
       on conflict do nothing`,
      [listId, t.kidIds, actor.id, t.ownerId],
    );
  }
  for (const [i, item] of items.entries()) {
    await client.query(
      `insert into gyfte_items (list_id, name, notes, size, color, price, links, position, received_at, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [listId, item.name, item.notes, item.size, item.color, item.price, item.links, i, item.received ? `${date}T12:00:00Z` : null, actor.id],
    );
  }
  return true;
}

/** Writes the plan. Returns how many lists and gifts were created. */
export async function applyPlan(
  actor: Actor,
  draftId: string,
  sheet: SheetImport,
  plan: ImportPlan,
): Promise<{ lists: number; gifts: number }> {
  const { group, tabs, keep } = await validatePlan(actor, sheet, plan);
  const me = await pool.query<{ name: string }>(`select name from "user" where id = $1`, [actor.id]);
  const client = await pool.connect();
  let lists = 0;
  let gifts = 0;
  try {
    await client.query("begin");
    const kidCache = new Map<string, string>();
    const kid = async (parentId: string, name: string) => {
      const k = `${parentId}|${name.toLowerCase()}`;
      if (!kidCache.has(k)) kidCache.set(k, await kidFor(client, parentId, name, actor.id));
      return kidCache.get(k)!;
    };

    for (const list of sheet.lists) {
      const tab = tabs[list.person];
      const items = list.items.filter((i) => keep.has(i.key));
      const write = async (t: Target, which: ImportedItem[]) => {
        if (await writeList(client, actor, group, t, list.year, which)) {
          lists += 1;
          gifts += which.length;
        }
      };
      switch (tab.who) {
        case "skip":
          break;
        case "me":
          await write({ ownerId: actor.id, recipientUserId: actor.id, recipientName: me.rows[0]?.name || list.person, kidIds: [] }, items);
          break;
        case "member": {
          const u = await client.query<{ name: string; email: string }>(`select name, email from "user" where id = $1`, [tab.userId]);
          const name = u.rows[0]?.name || list.person;
          await write({ ownerId: tab.userId, recipientUserId: tab.userId, recipientName: name, kidIds: [] }, items);
          break;
        }
        case "kid": {
          const id = await kid(tab.parentId, tab.kidName);
          await write({ ownerId: tab.parentId, recipientUserId: null, recipientName: tab.kidName, kidIds: [id] }, items);
          break;
        }
        case "split": {
          const ids = await Promise.all(tab.kids.map((n) => kid(tab.parentId, n)));
          for (const [i, name] of tab.kids.entries()) {
            await write(
              { ownerId: tab.parentId, recipientUserId: null, recipientName: name, kidIds: [ids[i]] },
              items.filter((it) => tab.rows[it.key] === name),
            );
          }
          await write(
            { ownerId: tab.parentId, recipientUserId: null, recipientName: [...tab.kids].sort().join(" & "), kidIds: ids },
            items.filter((it) => (tab.rows[it.key] ?? "both") === "both"),
          );
          break;
        }
        case "name":
          await write({ ownerId: actor.id, recipientUserId: null, recipientName: list.person, kidIds: [] }, items);
          break;
      }
    }
    await client.query("update gyfte_imports set applied_at = now() where id = $1", [draftId]);
    await client.query("insert into audit_events (actor_id, action, target, detail) values ($1, 'gyfte.import', $2, $3)", [
      actor.id,
      `gyfte-import/${draftId}`,
      JSON.stringify({ lists, gifts, groupId: group?.id ?? null }),
    ]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  return { lists, gifts };
}
