import "server-only";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { InputError } from "../errors";
import {
  AccessDenied,
  addToGroup,
  createGroup as createAccessGroup,
  grantItem,
  itemRole,
  requireAdmin,
  type Actor,
} from "../access";
import { atLeast } from "../access/roles";
import { displayName } from "./data";
import { isoDay, isPast, listTitle, nextChristmas, type Occasion } from "./occasions";

/**
 * Gyfte groups: a family or circle with a page showing its people and each
 * year's lists (Group > year > each person's list).
 *
 * - Membership is a regular warbag group, managed on the People screens.
 * - A list in a group is shared with that group (See and claim), so the
 *   usual claim rules apply: never shown to the person a list is for.
 * - Only admins create groups for now (others will request one).
 * - A sample group has made-up people an admin can "view as", and deletes
 *   cleanly, made to see how things work before real people join.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SAMPLE_EMAIL_DOMAIN = "sample.invalid";

type GroupRow = { id: string; name: string; access_group_id: string; is_sample: boolean };

async function loadGroup(groupId: string): Promise<GroupRow | null> {
  if (!UUID.test(groupId)) return null;
  const { rows } = await pool.query<GroupRow>(
    "select id, name, access_group_id, is_sample from gyfte_groups where id = $1",
    [groupId],
  );
  return rows[0] ?? null;
}

async function isMember(actor: Actor, accessGroupId: string): Promise<boolean> {
  const { rowCount } = await pool.query("select 1 from group_members where group_id = $1 and user_id = $2", [
    accessGroupId,
    actor.id,
  ]);
  return (rowCount ?? 0) > 0;
}

/** The group, if the person is in it. Admins aren't let in by being admins. */
async function groupForMember(actor: Actor, groupId: string): Promise<GroupRow> {
  const group = await loadGroup(groupId);
  if (!group || !(await isMember(actor, group.access_group_id))) throw new AccessDenied();
  return group;
}

// ---------------------------------------------------------------- groups

export async function createGyfteGroup(actor: Actor, name: string, opts: { sample?: boolean } = {}): Promise<string> {
  requireAdmin(actor);
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 80) throw new InputError("Group names are 1 to 80 characters.");
  const accessGroupId = await createAccessGroup(actor, clean);
  await addToGroup(actor, accessGroupId, actor.id);
  const { rows } = await pool.query<{ id: string }>(
    `insert into gyfte_groups (name, access_group_id, is_sample, created_by) values ($1, $2, $3, $4) returning id`,
    [clean, accessGroupId, opts.sample === true, actor.id],
  );
  return rows[0].id;
}

export type GroupSummary = { id: string; name: string; isSample: boolean; members: number };

/** Groups this person is in. */
export async function myGroups(actor: Actor): Promise<GroupSummary[]> {
  const { rows } = await pool.query(
    `select g.id, g.name, g.is_sample as "isSample",
       (select count(*)::int from group_members m2 where m2.group_id = g.access_group_id) as members
     from gyfte_groups g
     join group_members m on m.group_id = g.access_group_id and m.user_id = $1
     order by g.is_sample, lower(g.name)`,
    [actor.id],
  );
  return rows;
}

export type GroupRowView = {
  name: string;
  userId: string | null;
  isYou: boolean;
  list: { id: string; title: string; gifts: number } | null;
};

export type GroupPage = {
  id: string;
  name: string;
  isSample: boolean;
  accessGroupId: string;
  years: string[];
  year: string;
  christmas: GroupRowView[];
  birthdays: GroupRowView[];
  /** Made-up people an admin may view as (sample groups only). */
  samplePeople: { id: string; name: string }[];
};

/**
 * The group page for one year: every member with their Christmas list (or
 * "no list yet"), lists for people without accounts (kids), and that
 * year's birthday lists. Only lists the viewer can open are shown.
 */
export async function groupPage(viewer: Actor, groupId: string, wantYear?: string): Promise<GroupPage> {
  const group = await groupForMember(viewer, groupId);
  const members = await pool.query<{ id: string; name: string; email: string }>(
    `select u.id, u.name, u.email from group_members m join "user" u on u.id = m.user_id
     where m.group_id = $1 order by lower(coalesce(nullif(u.name, ''), u.email))`,
    [group.access_group_id],
  );
  const lists = await pool.query<{
    id: string;
    owner_id: string;
    recipient_user_id: string | null;
    recipient_name: string;
    occasion: Occasion;
    d: string;
    gifts: number;
  }>(
    `select l.id, l.owner_id, l.recipient_user_id, l.recipient_name, l.occasion,
       to_char(l.occasion_date, 'YYYY-MM-DD') as d,
       (select count(*)::int from gyfte_items i where i.list_id = l.id and i.received_at is null) as gifts
     from gyfte_lists l where l.group_id = $1 order by l.occasion_date`,
    [group.id],
  );
  const visible: (typeof lists.rows)[number][] = [];
  for (const l of lists.rows) {
    const role = await itemRole(viewer, { app: "gyfte", type: "list", id: l.id, ownerId: l.owner_id });
    if (atLeast(role, "view")) visible.push(l);
  }

  const thisYear = nextChristmas(isoDay(new Date())).slice(0, 4);
  const years = [...new Set([...visible.map((l) => l.d.slice(0, 4)), thisYear])].sort();
  const year = wantYear && years.includes(wantYear) ? wantYear : thisYear;
  const inYear = visible.filter((l) => l.d.startsWith(year));
  const view = (l: (typeof visible)[number]) => ({
    id: l.id,
    title: listTitle(l.recipient_name, l.occasion, l.d),
    gifts: l.gifts,
  });

  const christmasLists = inYear.filter((l) => l.occasion === "christmas");
  const christmas: GroupRowView[] = members.rows.map((m) => {
    const list = christmasLists.find((l) => l.recipient_user_id === m.id);
    return { name: displayName(m.name, m.email), userId: m.id, isYou: m.id === viewer.id, list: list ? view(list) : null };
  });
  // Lists for people without accounts (kids), and for anyone not in the group.
  for (const l of christmasLists) {
    if (!l.recipient_user_id || !members.rows.some((m) => m.id === l.recipient_user_id)) {
      christmas.push({ name: l.recipient_name, userId: null, isYou: false, list: view(l) });
    }
  }
  const birthdays: GroupRowView[] = inYear
    .filter((l) => l.occasion === "birthday")
    .map((l) => ({ name: l.recipient_name, userId: l.recipient_user_id, isYou: l.recipient_user_id === viewer.id, list: view(l) }));

  const samplePeople = group.is_sample
    ? (
        await pool.query<{ id: string; name: string }>(
          `select u.id, u.name from sample_people s join "user" u on u.id = s.user_id
           where s.gyfte_group_id = $1 order by u.name`,
          [group.id],
        )
      ).rows
    : [];

  return {
    id: group.id,
    name: group.name,
    isSample: group.is_sample,
    accessGroupId: group.access_group_id,
    years,
    year,
    christmas,
    birthdays,
    samplePeople,
  };
}

/** Shares a list with a group and files it there. Needs manage on the list and membership. */
export async function addListToGroup(actor: Actor, listId: string, groupId: string): Promise<void> {
  const group = await groupForMember(actor, groupId);
  const { rows } = await pool.query<{ owner_id: string }>("select owner_id from gyfte_lists where id = $1", [listId]);
  if (!rows[0]) throw new AccessDenied();
  const ref = { app: "gyfte", type: "list", id: listId, ownerId: rows[0].owner_id };
  await grantItem(actor, ref, { groupId: group.access_group_id }, "contribute");
  await pool.query("update gyfte_lists set group_id = $2, updated_at = now() where id = $1", [listId, group.id]);
}

/**
 * "Start my list" on a group page: your Christmas list for that year, in
 * the group. Being in the group is enough; Gyfte app access isn't needed.
 */
export async function startMyGroupList(actor: Actor, groupId: string, year: string): Promise<string> {
  const group = await groupForMember(actor, groupId);
  if (!/^\d{4}$/.test(year)) throw new InputError("Pick a year.");
  const date = `${year}-12-25`;
  if (isPast(date, isoDay(new Date()))) throw new InputError("That Christmas is in History. Start this year's list instead.");
  const me = await pool.query<{ name: string }>(`select name from "user" where id = $1`, [actor.id]);
  const name = me.rows[0]?.name?.trim();
  if (!name) throw new InputError("Set your name on your Account page first, so people know whose list it is.");

  const existing = await pool.query<{ id: string }>(
    `select id from gyfte_lists where recipient_user_id = $1 and occasion = 'christmas' and occasion_date = $2 limit 1`,
    [actor.id, date],
  );
  if (existing.rows[0]) {
    await addListToGroup(actor, existing.rows[0].id, group.id);
    return existing.rows[0].id;
  }
  const { rows } = await pool.query<{ id: string }>(
    `insert into gyfte_lists (owner_id, recipient_user_id, recipient_name, occasion, occasion_date, group_id)
     values ($1, $1, $2, 'christmas', $3, $4) returning id`,
    [actor.id, name, date, group.id],
  );
  await grantItem(actor, { app: "gyfte", type: "list", id: rows[0].id, ownerId: actor.id }, { groupId: group.access_group_id }, "contribute");
  return rows[0].id;
}

// ---------------------------------------------------------------- view as (sample only)

/**
 * Who a page should be rendered for. An admin may view as a made-up person
 * from a sample group (read-only); anyone else, or any real person, is
 * ignored and the page renders for the signed-in person.
 */
export async function viewerFor(
  actor: Actor,
  asUserId: string | undefined,
): Promise<{ viewer: Actor; previewName: string | null }> {
  if (!asUserId || !actor.isAdmin) return { viewer: actor, previewName: null };
  const { rows } = await pool.query<{ name: string }>(
    `select u.name from sample_people s join "user" u on u.id = s.user_id where s.user_id = $1`,
    [asUserId],
  );
  if (!rows[0]) return { viewer: actor, previewName: null };
  return { viewer: { id: asUserId, isAdmin: false }, previewName: rows[0].name };
}


// ---------------------------------------------------------------- the sample family

const SAMPLE = {
  people: ["Sample Mom", "Sample Dad", "Sample Aunt", "Sample Uncle", "Sample Grandma"],
  gifts: {
    "Sample Mom": ["Linen apron", "Herb garden kit", "Wool socks", "Cookbook", "Candle set"],
    "Sample Dad": ["Cast iron pan", "Fishing hat", "Coffee grinder", "Rain jacket"],
    "Sample Aunt": ["Pottery class", "Silk scarf", "Puzzle", "Tea sampler"],
    "Sample Uncle": ["Grill tools", "Field guide", "Flannel shirt"],
    "Sample Grandma": ["Photo frame", "Garden gloves", "Large-print crosswords"],
    "Sample Kid": ["Building blocks", "Picture book", "Toy train", "Crayons"],
  } as Record<string, string[]>,
};

/**
 * Creates "Sample family": five made-up people and a kid, this year's and
 * last year's Christmas lists, and a few claims, all shared in the group.
 * The admin is a member, so they can open it and "view as" anyone in it.
 */
export async function createSampleFamily(actor: Actor): Promise<string> {
  requireAdmin(actor);
  const existing = await pool.query<{ id: string }>(
    `select g.id from gyfte_groups g join group_members m on m.group_id = g.access_group_id and m.user_id = $1
     where g.is_sample limit 1`,
    [actor.id],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const groupId = await createGyfteGroup(actor, "Sample family", { sample: true });
  const group = (await loadGroup(groupId))!;
  const ids: Record<string, string> = {};
  for (const name of SAMPLE.people) {
    const id = randomUUID();
    ids[name] = id;
    await pool.query(
      `insert into "user" ("id", "name", "email", "emailVerified", "updatedAt") values ($1, $2, $3, true, now())`,
      [id, name, `${name.toLowerCase().replace(/\s+/g, "-")}-${id.slice(0, 6)}@${SAMPLE_EMAIL_DOMAIN}`],
    );
    await pool.query("insert into sample_people (user_id, gyfte_group_id) values ($1, $2)", [id, groupId]);
    await addToGroup(actor, group.access_group_id, id);
  }

  const thisYear = Number(nextChristmas(isoDay(new Date())).slice(0, 4));
  const makeList = async (ownerId: string, recipientId: string | null, recipient: string, year: number) => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into gyfte_lists (owner_id, recipient_user_id, recipient_name, occasion, occasion_date, group_id)
       values ($1, $2, $3, 'christmas', $4, $5) returning id`,
      [ownerId, recipientId, recipient, `${year}-12-25`, groupId],
    );
    await pool.query(
      `insert into item_grants (app, item_type, item_id, group_id, role, created_by) values ('gyfte', 'list', $1, $2, 'contribute', $3)`,
      [rows[0].id, group.access_group_id, ownerId],
    );
    const gifts = SAMPLE.gifts[recipient];
    const made: string[] = [];
    for (const [i, gift] of gifts.entries()) {
      const r = await pool.query<{ id: string }>(
        `insert into gyfte_items (list_id, name, position, received_at, created_by) values ($1, $2, $3, $4, $5) returning id`,
        // Last year's first gift was received, so history shows a Got it.
        [rows[0].id, gift, i, year < thisYear && i === 0 ? `${year}-12-25T12:00:00Z` : null, ownerId],
      );
      made.push(r.rows[0].id);
    }
    return { listId: rows[0].id, items: made };
  };

  const current: Record<string, { listId: string; items: string[] }> = {};
  for (const name of SAMPLE.people) {
    await makeList(ids[name], ids[name], name, thisYear - 1);
    current[name] = await makeList(ids[name], ids[name], name, thisYear);
  }
  // The kid's lists are managed by Sample Mom.
  await makeList(ids["Sample Mom"], null, "Sample Kid", thisYear - 1);
  current["Sample Kid"] = await makeList(ids["Sample Mom"], null, "Sample Kid", thisYear);

  // A few claims, so every view has something to show.
  const claim = async (claimer: string, recipient: string, index: number) => {
    const { listId, items } = current[recipient];
    await pool.query(
      `insert into gyfte_claims (item_id, list_id, claimer_id, item_name, list_title) values ($1, $2, $3, $4, $5)`,
      [items[index], listId, ids[claimer], SAMPLE.gifts[recipient][index], listTitle(recipient, "christmas", `${thisYear}-12-25`)],
    );
  };
  await claim("Sample Aunt", "Sample Mom", 0);
  await claim("Sample Dad", "Sample Mom", 2);
  await claim("Sample Grandma", "Sample Kid", 0);
  await claim("Sample Mom", "Sample Aunt", 1);
  await claim("Sample Uncle", "Sample Dad", 1);
  return groupId;
}

/** Deletes a sample group with its made-up people and every list in it. */
export async function deleteSampleFamily(actor: Actor, groupId: string): Promise<void> {
  requireAdmin(actor);
  const group = await loadGroup(groupId);
  if (!group || !group.is_sample) throw new AccessDenied();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const lists = await client.query<{ id: string }>("select id from gyfte_lists where group_id = $1", [group.id]);
    const listIds = lists.rows.map((l) => l.id);
    await client.query("delete from item_grants where app = 'gyfte' and item_type = 'list' and item_id = any($1::text[])", [listIds]);
    await client.query("delete from share_links where app = 'gyfte' and item_type = 'list' and item_id = any($1::text[])", [listIds]);
    await client.query("delete from gyfte_claims where list_id = any($1::uuid[])", [listIds]);
    await client.query("delete from gyfte_lists where id = any($1::uuid[])", [listIds]);
    await client.query(
      `delete from "user" where id in (select user_id from sample_people where gyfte_group_id = $1)`,
      [group.id],
    );
    await client.query("delete from groups where id = $1", [group.access_group_id]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
