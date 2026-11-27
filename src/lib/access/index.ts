import "server-only";
import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { atLeast, highest, isRole, LINK_ROLES, type LinkRole, type Role } from "./roles";

export { atLeast, highest, ROLES, LINK_ROLES, type Role, type LinkRole } from "./roles";

/**
 * Warbag's access rules. Every check runs here, on the server, on every
 * request: nothing is cached, so removing someone takes effect immediately.
 *
 * - Admins manage people, groups and app access. Being admin does NOT open
 *   anyone else's items: content stays private to its owner and grantees.
 * - An item's owner always has manage. Others get a level from item grants
 *   (to them or a group they're in) or from a share link.
 * - Functions that change access take the acting user and check them.
 * - Callers that are refused should answer "not found", not "forbidden",
 *   so a guessed URL can't confirm that something exists.
 */

/** The signed-in person, as the access rules need them. */
export type Actor = {
  id: string;
  isAdmin: boolean;
  /** Can manage people and groups (src/lib/people.ts). */
  peopleManager?: boolean;
  /** Joined a Mosey trip by its link: no email, never sees Money unless the trip allows it, never receipts. */
  guest?: boolean;
};

/** An item in some app. `ownerId` comes from the app's own table. */
export type ItemRef = { app: string; type: string; id: string; ownerId: string };

export class AccessDenied extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "AccessDenied";
  }
}

const SLUG = /^[a-z][a-z0-9-]{0,39}$/;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;

function checkRef(item: Omit<ItemRef, "ownerId">) {
  if (!SLUG.test(item.app) || !SLUG.test(item.type) || !item.id || item.id.length > 100) {
    throw new Error(`Invalid item reference: ${item.app}/${item.type}/${item.id}`);
  }
}

export async function audit(
  db: Pick<PoolClient, "query">,
  actorId: string | null,
  action: string,
  target: string,
  detail: Record<string, unknown> = {},
) {
  await db.query(
    "insert into audit_events (actor_id, action, target, detail) values ($1, $2, $3, $4)",
    [actorId, action, target, JSON.stringify(detail)],
  );
}

const itemTarget = (item: Omit<ItemRef, "ownerId">) => `${item.app}/${item.type}/${item.id}`;

// ---------------------------------------------------------------- groups

export function requireAdmin(actor: Actor) {
  if (!actor.isAdmin) throw new AccessDenied("Only admins can do this");
}

export async function createGroup(actor: Actor, name: string): Promise<string> {
  requireAdmin(actor);
  const clean = name.trim();
  if (!clean || clean.length > 80) throw new Error("Group names are 1 to 80 characters");
  const { rows } = await pool.query<{ id: string }>(
    "insert into groups (name, created_by) values ($1, $2) returning id",
    [clean, actor.id],
  );
  await audit(pool, actor.id, "group.create", `group/${rows[0].id}`, { name: clean });
  return rows[0].id;
}

export async function deleteGroup(actor: Actor, groupId: string): Promise<void> {
  requireAdmin(actor);
  // Grants to the group go with it (on delete cascade).
  await pool.query("delete from groups where id = $1", [groupId]);
  await audit(pool, actor.id, "group.delete", `group/${groupId}`);
}

export async function addToGroup(actor: Actor, groupId: string, userId: string): Promise<void> {
  requireAdmin(actor);
  await pool.query(
    "insert into group_members (group_id, user_id) values ($1, $2) on conflict do nothing",
    [groupId, userId],
  );
  await audit(pool, actor.id, "group.add", `group/${groupId}`, { userId });
}

export async function removeFromGroup(actor: Actor, groupId: string, userId: string): Promise<void> {
  requireAdmin(actor);
  await pool.query("delete from group_members where group_id = $1 and user_id = $2", [groupId, userId]);
  await audit(pool, actor.id, "group.remove", `group/${groupId}`, { userId });
}

/** Groups this person belongs to (admins: all groups). For pickers. */
export async function groupsFor(actor: Actor): Promise<{ id: string; name: string }[]> {
  const { rows } = actor.isAdmin
    ? await pool.query("select id, name from groups order by lower(name)")
    : await pool.query(
        `select g.id, g.name from groups g
         join group_members m on m.group_id = g.id
         where m.user_id = $1 order by lower(g.name)`,
        [actor.id],
      );
  return rows;
}

// ------------------------------------------------------------ app access

export type Grantee = { userId: string } | { groupId: string };

function granteeColumns(to: Grantee): [string | null, string | null] {
  return "userId" in to ? [to.userId, null] : [null, to.groupId];
}

/** Can this person open the app and make their own items in it? */
export async function canUseApp(actor: Actor, app: string): Promise<boolean> {
  if (actor.isAdmin) return true;
  const { rowCount } = await pool.query(
    `select 1 from app_grants
     where app = $1 and (user_id = $2 or group_id in
       (select group_id from group_members where user_id = $2))
     limit 1`,
    [app, actor.id],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Has anything in this app been shared with this person (directly or
 * through a group)? Being shared an item lets you open the app to see it,
 * even without app access of your own (which is about making new items).
 */
export async function hasItemGrants(actor: Actor, app: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `select 1 from item_grants
     where app = $1 and (user_id = $2 or group_id in
       (select group_id from group_members where user_id = $2))
     limit 1`,
    [app, actor.id],
  );
  return (rowCount ?? 0) > 0;
}

export async function grantApp(actor: Actor, app: string, to: Grantee): Promise<void> {
  requireAdmin(actor);
  if (!SLUG.test(app)) throw new Error(`Invalid app id: ${app}`);
  const [userId, groupId] = granteeColumns(to);
  await pool.query(
    `insert into app_grants (app, user_id, group_id, created_by) values ($1, $2, $3, $4)
     on conflict do nothing`,
    [app, userId, groupId, actor.id],
  );
  await audit(pool, actor.id, "app.grant", `app/${app}`, { userId, groupId });
}

export async function revokeApp(actor: Actor, app: string, to: Grantee): Promise<void> {
  requireAdmin(actor);
  const [userId, groupId] = granteeColumns(to);
  await pool.query(
    "delete from app_grants where app = $1 and user_id is not distinct from $2 and group_id is not distinct from $3",
    [app, userId, groupId],
  );
  await audit(pool, actor.id, "app.revoke", `app/${app}`, { userId, groupId });
}

// ------------------------------------------------------------ item access

/**
 * This person's level on an item, or null for no access.
 * `actor` is null for someone not signed in (only a link can help them).
 */
export async function itemRole(
  actor: Actor | null,
  item: ItemRef,
  opts: { linkToken?: string } = {},
): Promise<Role | null> {
  checkRef(item);
  const levels: (Role | null)[] = [];

  if (actor) {
    if (actor.id === item.ownerId) return "manage";
    const { rows } = await pool.query<{ role: string }>(
      `select role from item_grants
       where app = $1 and item_type = $2 and item_id = $3
         and (user_id = $4 or group_id in
           (select group_id from group_members where user_id = $4))`,
      [item.app, item.type, item.id, actor.id],
    );
    for (const r of rows) if (isRole(r.role)) levels.push(r.role);
  }

  if (opts.linkToken) {
    const link = await resolveShareLink(opts.linkToken);
    if (link && link.app === item.app && link.type === item.type && link.id === item.id) {
      levels.push(link.role);
    }
  }

  return highest(levels);
}

/** The level, or AccessDenied if it's below `need`. Callers show "not found". */
export async function requireItemRole(
  actor: Actor | null,
  item: ItemRef,
  need: Role,
  opts: { linkToken?: string } = {},
): Promise<Role> {
  const role = await itemRole(actor, item, opts);
  if (!atLeast(role, need)) throw new AccessDenied();
  return role!;
}

export async function grantItem(actor: Actor, item: ItemRef, to: Grantee, role: Role): Promise<void> {
  await requireItemRole(actor, item, "manage");
  if (!isRole(role)) throw new Error(`Invalid role: ${role}`);
  const [userId, groupId] = granteeColumns(to);
  // Non-admins may share only with groups they're in, so group names and
  // members stay private to those groups.
  if (groupId && !actor.isAdmin) {
    const mine = await groupsFor(actor);
    if (!mine.some((g) => g.id === groupId)) throw new AccessDenied();
  }
  const conflict = userId
    ? "(app, item_type, item_id, user_id) where user_id is not null"
    : "(app, item_type, item_id, group_id) where group_id is not null";
  await pool.query(
    `insert into item_grants (app, item_type, item_id, user_id, group_id, role, created_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict ${conflict} do update set role = excluded.role`,
    [item.app, item.type, item.id, userId, groupId, role, actor.id],
  );
  await audit(pool, actor.id, "item.grant", itemTarget(item), { userId, groupId, role });
}

export async function revokeItem(actor: Actor, item: ItemRef, to: Grantee): Promise<void> {
  await requireItemRole(actor, item, "manage");
  const [userId, groupId] = granteeColumns(to);
  await pool.query(
    `delete from item_grants
     where app = $1 and item_type = $2 and item_id = $3
       and user_id is not distinct from $4 and group_id is not distinct from $5`,
    [item.app, item.type, item.id, userId, groupId],
  );
  await audit(pool, actor.id, "item.revoke", itemTarget(item), { userId, groupId });
}

export type ItemGrant = {
  userId: string | null;
  email: string | null;
  groupId: string | null;
  groupName: string | null;
  role: Role;
};

/** Who has access to an item (for its Share screen). Managers only. */
export async function listItemGrants(actor: Actor, item: ItemRef): Promise<ItemGrant[]> {
  await requireItemRole(actor, item, "manage");
  const { rows } = await pool.query(
    `select g.user_id as "userId", u.email, g.group_id as "groupId", gr.name as "groupName", g.role
     from item_grants g
     left join "user" u on u.id = g.user_id
     left join groups gr on gr.id = g.group_id
     where g.app = $1 and g.item_type = $2 and g.item_id = $3
     order by g.created_at`,
    [item.app, item.type, item.id],
  );
  return rows;
}

/** Item ids of one type shared with this person, with their best level. */
export async function itemsSharedWith(
  actor: Actor,
  app: string,
  type: string,
): Promise<{ id: string; role: Role }[]> {
  const { rows } = await pool.query<{ id: string; roles: string[] }>(
    `select item_id as id, array_agg(role) as roles from item_grants
     where app = $1 and item_type = $2 and (user_id = $3 or group_id in
       (select group_id from group_members where user_id = $3))
     group by item_id`,
    [app, type, actor.id],
  );
  return rows.map((r) => ({ id: r.id, role: highest(r.roles.filter(isRole))! }));
}

// ------------------------------------------------------------ share links

export type ShareLink = {
  id: string;
  token: string;
  role: LinkRole;
  createdAt: Date;
  expiresAt: Date | null;
};

/**
 * A new link for one item. Managers only. The token is 24 random bytes
 * (192 bits), so links can't be guessed.
 */
export async function createShareLink(
  actor: Actor,
  item: ItemRef,
  opts: { role?: LinkRole; expiresAt?: Date | null } = {},
): Promise<ShareLink> {
  await requireItemRole(actor, item, "manage");
  const role = opts.role ?? "view";
  if (!(LINK_ROLES as readonly string[]).includes(role)) throw new Error(`Links can't grant ${role}`);
  const token = randomBytes(24).toString("base64url");
  const { rows } = await pool.query(
    `insert into share_links (token, app, item_type, item_id, role, created_by, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, token, role, created_at as "createdAt", expires_at as "expiresAt"`,
    [token, item.app, item.type, item.id, role, actor.id, opts.expiresAt ?? null],
  );
  await audit(pool, actor.id, "link.create", itemTarget(item), { linkId: rows[0].id, role });
  return rows[0];
}

/** Active links for an item (for its Share screen). Managers only. */
export async function listShareLinks(actor: Actor, item: ItemRef): Promise<ShareLink[]> {
  await requireItemRole(actor, item, "manage");
  const { rows } = await pool.query(
    `select id, token, role, created_at as "createdAt", expires_at as "expiresAt"
     from share_links
     where app = $1 and item_type = $2 and item_id = $3
       and revoked_at is null and (expires_at is null or expires_at > now())
     order by created_at`,
    [item.app, item.type, item.id],
  );
  return rows;
}

/** Turns a link off for good. The link must belong to this item. */
export async function revokeShareLink(actor: Actor, item: ItemRef, linkId: string): Promise<void> {
  await requireItemRole(actor, item, "manage");
  await pool.query(
    `update share_links set revoked_at = now()
     where id = $1 and app = $2 and item_type = $3 and item_id = $4 and revoked_at is null`,
    [linkId, item.app, item.type, item.id],
  );
  await audit(pool, actor.id, "link.revoke", itemTarget(item), { linkId });
}

/**
 * What a link opens, or null if it's malformed, unknown, revoked or expired.
 * The app then loads the item and checks it with `itemRole`.
 */
export async function resolveShareLink(
  token: string,
): Promise<{ app: string; type: string; id: string; role: LinkRole } | null> {
  if (!TOKEN.test(token)) return null;
  const { rows } = await pool.query(
    `select app, item_type as type, item_id as id, role from share_links
     where token = $1 and revoked_at is null and (expires_at is null or expires_at > now())`,
    [token],
  );
  return rows[0] ?? null;
}

/**
 * Removes every grant and link for an item. Apps call this when they delete
 * the item, after checking the person may delete it.
 */
export async function forgetItem(actor: Actor, item: ItemRef): Promise<void> {
  await requireItemRole(actor, item, "manage");
  const args = [item.app, item.type, item.id];
  await pool.query("delete from item_grants where app = $1 and item_type = $2 and item_id = $3", args);
  await pool.query("delete from share_links where app = $1 and item_type = $2 and item_id = $3", args);
  await audit(pool, actor.id, "item.forget", itemTarget(item));
}
