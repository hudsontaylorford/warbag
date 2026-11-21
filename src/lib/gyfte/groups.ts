import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
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
import { auth } from "../auth";
import { kidsOfMembers, linkListToKids } from "./kids";

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

type GroupRow = { id: string; name: string; access_group_id: string; is_sample: boolean; invite_token: string | null };

async function loadGroup(groupId: string): Promise<GroupRow | null> {
  if (!UUID.test(groupId)) return null;
  const { rows } = await pool.query<GroupRow>(
    "select id, name, access_group_id, is_sample, invite_token from gyfte_groups where id = $1",
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
  /** Set on a kid's row (shown under their parent). */
  kidId?: string;
  /** A list for siblings together. */
  joint?: boolean;
  /** Shown indented under the row above (kids and joint lists). */
  nested?: boolean;
  /** The viewer is this kid's parent, so they may start the kid's list. */
  canStart?: boolean;
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
  /** The viewer's kids shown in this group (for "Start a joint list"). */
  myKids: { id: string; name: string }[];
  /** Whether a joint list for all of myKids already exists this year. */
  hasJointForMyKids: boolean;
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
  return buildGroupPage(group, viewer, wantYear);
}

/**
 * The page for a member (`viewer`: only lists they can open) or for a
 * family-link visitor (`viewer` null: every list filed in the group).
 */
async function buildGroupPage(group: GroupRow, viewer: Actor | null, wantYear?: string): Promise<GroupPage> {
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
    if (!viewer) {
      visible.push(l);
      continue;
    }
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

  // Which kid(s) each list is for.
  const listKids = new Map<string, string[]>();
  if (christmasLists.length) {
    const lk = await pool.query<{ list_id: string; kids: string[] }>(
      `select list_id, array_agg(kid_id::text order by kid_id) as kids from gyfte_list_kids
       where list_id = any($1::uuid[]) group by list_id`,
      [christmasLists.map((l) => l.id)],
    );
    for (const r of lk.rows) listKids.set(r.list_id, r.kids);
  }
  const kids = await kidsOfMembers(group.access_group_id, group.is_sample);
  const memberIds = members.rows.map((m) => m.id);
  const placed = new Set<string>();
  const christmas: GroupRowView[] = [];

  for (const m of members.rows) {
    const own = christmasLists.find((l) => l.recipient_user_id === m.id);
    if (own) placed.add(own.id);
    christmas.push({ name: displayName(m.name, m.email), userId: m.id, isYou: m.id === viewer?.id, list: own ? view(own) : null });

    // Kids appear once, under their first parent who is in this group.
    const theirKids = kids.filter((k) => k.parentIds.find((p) => memberIds.includes(p)) === m.id);
    for (const k of theirKids) {
      const list = christmasLists.find((l) => (listKids.get(l.id) ?? []).join(",") === k.id);
      if (list) placed.add(list.id);
      christmas.push({
        name: k.name,
        userId: null,
        isYou: false,
        list: list ? view(list) : null,
        kidId: k.id,
        nested: true,
        canStart: Boolean(viewer && k.parentIds.includes(viewer.id)),
      });
    }
    // Joint lists for these kids.
    const ids = new Set(theirKids.map((k) => k.id));
    for (const l of christmasLists) {
      const set = listKids.get(l.id) ?? [];
      if (set.length > 1 && set.every((id) => ids.has(id)) && !placed.has(l.id)) {
        placed.add(l.id);
        christmas.push({ name: `${l.recipient_name} (together)`, userId: null, isYou: false, list: view(l), joint: true, nested: true });
      }
    }
  }
  // Anything else filed here (name-only lists, people not in the group).
  for (const l of christmasLists) {
    if (!placed.has(l.id) && (!l.recipient_user_id || !memberIds.includes(l.recipient_user_id))) {
      christmas.push({ name: l.recipient_name, userId: null, isYou: false, list: view(l), joint: (listKids.get(l.id) ?? []).length > 1 });
    }
  }

  const myKids = viewer ? kids.filter((k) => k.parentIds.includes(viewer.id)).map((k) => ({ id: k.id, name: k.name })) : [];
  const allMine = myKids.map((k) => k.id).sort().join(",");
  const hasJointForMyKids =
    myKids.length > 1 && christmasLists.some((l) => (listKids.get(l.id) ?? []).join(",") === allMine);
  const birthdays: GroupRowView[] = inYear
    .filter((l) => l.occasion === "birthday")
    .map((l) => ({ name: l.recipient_name, userId: l.recipient_user_id, isYou: l.recipient_user_id === viewer?.id, list: view(l) }));

  const samplePeople = group.is_sample && viewer
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
    myKids,
    hasJointForMyKids,
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
    "Sample Baby": ["Stacking cups", "Soft blocks", "Board book"],
    "Sample Baby & Sample Kid": ["Play tent", "Wagon", "Train table"],
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
  // Two kids, with Sample Mom and Sample Dad as parents, their own lists,
  // and a joint list for gifts for both.
  const mom = { id: ids["Sample Mom"], isAdmin: false };
  const kidIds: Record<string, string> = {};
  for (const name of ["Sample Kid", "Sample Baby"]) {
    const k = await pool.query<{ id: string }>("insert into gyfte_kids (name, created_by) values ($1, $2) returning id", [
      name,
      mom.id,
    ]);
    kidIds[name] = k.rows[0].id;
    await pool.query("insert into gyfte_kid_parents (kid_id, user_id) values ($1, $2), ($1, $3)", [
      k.rows[0].id,
      ids["Sample Mom"],
      ids["Sample Dad"],
    ]);
  }
  const kidList = async (recipient: string, kids: string[], year: number) => {
    const made = await makeList(mom.id, null, recipient, year);
    await linkListToKids(mom, made.listId, kids.map((n) => kidIds[n]));
    return made;
  };
  await kidList("Sample Kid", ["Sample Kid"], thisYear - 1);
  current["Sample Kid"] = await kidList("Sample Kid", ["Sample Kid"], thisYear);
  current["Sample Baby"] = await kidList("Sample Baby", ["Sample Baby"], thisYear);
  current["Sample Baby & Sample Kid"] = await kidList("Sample Baby & Sample Kid", ["Sample Kid", "Sample Baby"], thisYear);

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
  await claim("Sample Uncle", "Sample Baby & Sample Kid", 1);
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
      `delete from gyfte_kids where id in (
         select p.kid_id from gyfte_kid_parents p join sample_people s on s.user_id = p.user_id
         where s.gyfte_group_id = $1)`,
      [group.id],
    );
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

// ---------------------------------------------------------------- family links

const TOKEN = /^[A-Za-z0-9_-]{32}$/;

/** The group's family link token (admins who are members; never for samples). */
export async function familyLink(actor: Actor, groupId: string): Promise<string | null> {
  requireAdmin(actor);
  const group = await groupForMember(actor, groupId);
  return group.invite_token;
}

/**
 * Turns the family link on (a new link each time: "Replace" stops the old
 * one) or off. Admin and member of the group; sample groups have no link.
 */
export async function setFamilyLink(actor: Actor, groupId: string, on: boolean): Promise<string | null> {
  requireAdmin(actor);
  const group = await groupForMember(actor, groupId);
  if (group.is_sample) throw new InputError("The sample family can't have a family link.");
  const token = on ? randomBytes(24).toString("base64url") : null;
  await pool.query("update gyfte_groups set invite_token = $2 where id = $1", [group.id, token]);
  await pool.query("insert into audit_events (actor_id, action, target) values ($1, $2, $3)", [
    actor.id,
    on ? "group.link.new" : "group.link.off",
    `gyfte-group/${group.id}`,
  ]);
  return token;
}

async function groupByToken(token: string): Promise<GroupRow | null> {
  if (!TOKEN.test(token)) return null;
  const { rows } = await pool.query<GroupRow>(
    "select id, name, access_group_id, is_sample, invite_token from gyfte_groups where invite_token = $1 and not is_sample",
    [token],
  );
  return rows[0] ?? null;
}

/** Is this signed-in person a member of the link's group? (Then they get the real page.) */
export async function memberGroupIdForLink(actor: Actor, token: string): Promise<string | null> {
  const group = await groupByToken(token);
  return group && (await isMember(actor, group.access_group_id)) ? group.id : null;
}

/**
 * What a family link shows: names, years and wanted-gift counts, for every
 * list filed in the group. No claims; nobody is signed in by this.
 */
export async function publicGroupPage(token: string, wantYear?: string): Promise<GroupPage | null> {
  const group = await groupByToken(token);
  return group ? buildGroupPage(group, null, wantYear) : null;
}

export type PublicGift = { id: string; name: string; notes: string; size: string; color: string; price: string; links: string[]; starred: boolean };

/** One list in the link's group: wanted gifts only, no claims. */
export async function publicGroupList(
  token: string,
  listId: string,
): Promise<{ title: string; groupName: string; gifts: PublicGift[] } | null> {
  const group = await groupByToken(token);
  if (!group || !UUID.test(listId)) return null;
  const { rows } = await pool.query<{ recipient_name: string; occasion: Occasion; d: string }>(
    `select recipient_name, occasion, to_char(occasion_date, 'YYYY-MM-DD') as d from gyfte_lists where id = $1 and group_id = $2`,
    [listId, group.id],
  );
  if (!rows[0]) return null;
  const gifts = await pool.query<PublicGift>(
    `select id, name, notes, size, color, price, links, starred from gyfte_items
     where list_id = $1 and received_at is null order by starred desc, position asc`,
    [listId],
  );
  return { title: listTitle(rows[0].recipient_name, rows[0].occasion, rows[0].d), groupName: group.name, gifts: gifts.rows };
}

/**
 * Where a family-link sign-in lands: the list they were looking at, if it's
 * in this group, else the group. Built here from ids, never taken from input.
 */
export async function returnPath(groupId: string, listId?: string | null): Promise<string> {
  if (listId && UUID.test(listId)) {
    const { rowCount } = await pool.query("select 1 from gyfte_lists where id = $1 and group_id = $2", [listId, groupId]);
    if (rowCount) return `/gyfte/${listId}`;
  }
  return `/gyfte/groups/${groupId}`;
}

export const THIS_IS_ME_LIMIT = { perPerson: 3, perGroup: 30, minutes: 15 };

/**
 * "This is me": emails that person a one-tap sign-in link at the address
 * on their account. Picking someone else's name only sends them an email;
 * nothing about their account is shown. Limited per person and per group.
 */
export async function sendThisIsMe(
  token: string,
  userId: string,
  headers: Headers,
  fromListId?: string,
): Promise<{ name: string }> {
  const group = await groupByToken(token);
  if (!group) throw new InputError("This family link isn't working anymore. Ask for a new one.");
  const { rows } = await pool.query<{ email: string; name: string }>(
    `select u.email, u.name from group_members m join "user" u on u.id = m.user_id
     where m.group_id = $1 and m.user_id = $2`,
    [group.access_group_id, userId],
  );
  const person = rows[0];
  if (!person || person.email.endsWith(`@${SAMPLE_EMAIL_DOMAIN}`)) throw new InputError("That person isn't in this group.");

  const { rows: recent } = await pool.query<{ mine: number; all: number }>(
    `select count(*) filter (where user_id = $1)::int as mine, count(*)::int as all
     from sign_in_link_sends where group_id = $2 and sent_at > now() - make_interval(mins => $3)`,
    [userId, group.id, THIS_IS_ME_LIMIT.minutes],
  );
  if (recent[0].mine >= THIS_IS_ME_LIMIT.perPerson || recent[0].all >= THIS_IS_ME_LIMIT.perGroup) {
    throw new InputError("A sign-in link was just sent. Check your email, or try again in 15 minutes.");
  }

  await pool.query("insert into sign_in_link_sends (user_id, group_id) values ($1, $2)", [userId, group.id]);
  await auth.api.signInMagicLink({
    body: { email: person.email, callbackURL: await returnPath(group.id, fromListId), metadata: { group: group.name } },
    headers,
  });
  return { name: displayName(person.name, person.email) };
}
