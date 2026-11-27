import "server-only";
import { randomUUID } from "node:crypto";
import { pool } from "./db";
import {
  AccessDenied,
  addToGroup,
  audit,
  createGroup,
  grantApp,
  removeFromGroup,
  requireAdmin,
  revokeApp,
  type Actor,
} from "./access";
import { APPS } from "./apps";
import { sendEmail } from "./email";
import { siteUrl } from "./site";

/**
 * Management of people, groups and app access. Every function checks the
 * actor itself, so screens can't skip the check.
 *
 * Admins can do everything here. A people manager (a non-admin, e.g. an
 * assistant's account) can invite and rename people, create and edit groups
 * and who's in them, and give app access, but never: change its own apps
 * or groups, change an admin, give apps to a group it's in, remove people,
 * delete groups, or make anyone an admin or a people manager.
 */

/** Admins and people managers; returns the actor the access helpers run as. */
function manager(actor: Actor): Actor {
  if (actor.isAdmin) return actor;
  if (!actor.peopleManager) throw new AccessDenied("Only admins and people managers can do this");
  // The access helpers are admin-only; the people-manager limits are checked here first.
  return { id: actor.id, isAdmin: true };
}

/** A people manager never changes its own access or an admin's. */
async function checkTarget(actor: Actor, userId: string) {
  if (actor.isAdmin) return;
  if (userId === actor.id) throw new AccessDenied("People managers can't change their own access");
  const { rows } = await pool.query<{ isAdmin: boolean }>(`select "isAdmin" from "user" where id = $1`, [userId]);
  if (rows[0]?.isAdmin) throw new AccessDenied("Only admins can change an admin");
}

import { InputError } from "./errors";

export { InputError };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) throw new InputError("Enter a full email address, like name@example.com.");
  return email;
}

function cleanName(raw: string | null | undefined, max = 80): string {
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length > max) throw new InputError(`Names are at most ${max} characters.`);
  return name;
}

function checkAppIds(apps: string[]): string[] {
  const known = new Set(APPS.map((a) => a.id));
  const unique = [...new Set(apps)];
  for (const app of unique) if (!known.has(app)) throw new InputError(`Unknown app: ${app}`);
  return unique;
}

// ---------------------------------------------------------------- people

export type PersonRow = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  peopleManager: boolean;
  groups: string[];
  lastSignIn: Date | null;
};

export async function listPeople(actor: Actor): Promise<PersonRow[]> {
  manager(actor);
  const { rows } = await pool.query(
    `select u.id, u.email, u.name, u."isAdmin", u."isPeopleManager" as "peopleManager",
       coalesce(array_agg(distinct g.name) filter (where g.name is not null), '{}') as groups,
       (select max(s."createdAt") from "session" s where s."userId" = u.id) as "lastSignIn"
     from "user" u
     left join group_members m on m.user_id = u.id
     left join groups g on g.id = m.group_id
     -- Guests (joined a Mosey trip by link) belong to their trips, not here.
     where not u."isGuest"
     group by u.id
     order by u."isAdmin" desc, lower(coalesce(nullif(u.name, ''), u.email))`,
  );
  return rows;
}

export type Person = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  peopleManager: boolean;
  groupIds: string[];
  apps: string[];
};

/** One person, with their groups and the apps given to them directly. */
export async function getPerson(actor: Actor, userId: string): Promise<Person | null> {
  manager(actor);
  const { rows } = await pool.query(
    `select u.id, u.email, u.name, u."isAdmin", u."isPeopleManager" as "peopleManager",
       coalesce((select array_agg(group_id::text) from group_members where user_id = u.id), '{}') as "groupIds",
       coalesce((select array_agg(app) from app_grants where user_id = u.id), '{}') as apps
     from "user" u where u.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * Adds someone to warbag (or finds them if they're already here) and, if
 * asked, emails them how to sign in. They get no apps until given some.
 */
export async function invitePerson(
  actor: Actor,
  input: { email: string; name?: string; sendEmail?: boolean },
): Promise<{ id: string; created: boolean; emailed: boolean }> {
  manager(actor);
  const email = normalizeEmail(input.email);
  const name = cleanName(input.name);

  const { rows } = await pool.query<{ id: string; created: boolean }>(
    `insert into "user" ("id", "name", "email", "emailVerified", "updatedAt")
     values ($1, $2, $3, true, now())
     on conflict ("email") do update set "email" = excluded."email"
     returning id, (xmax = 0) as created`,
    [randomUUID(), name, email],
  );
  const { id, created } = rows[0];
  if (created) await audit(pool, actor.id, "person.invite", `user/${id}`, { email });

  let emailed = false;
  if (input.sendEmail !== false) {
    const inviter = await pool.query<{ name: string; email: string }>(
      `select name, email from "user" where id = $1`,
      [actor.id],
    );
    const from = inviter.rows[0]?.name || inviter.rows[0]?.email || "Someone";
    await sendEmail({ to: email, ...inviteEmail(from, email) });
    emailed = true;
  }
  return { id, created, emailed };
}

export function inviteEmail(from: string, email: string): { subject: string; text: string } {
  return {
    subject: `${from} invited you to warbag`,
    text:
      `${from} added you to warbag.\n\n` +
      `To sign in, go to ${siteUrl()}/sign-in and enter ${email}. ` +
      `We'll email you a 6-digit code. No password needed.\n`,
  };
}

export async function renamePerson(actor: Actor, userId: string, name: string): Promise<void> {
  manager(actor);
  if (userId !== actor.id) await checkTarget(actor, userId);
  const clean = cleanName(name);
  await pool.query(`update "user" set name = $2, "updatedAt" = now() where id = $1`, [userId, clean]);
  await audit(pool, actor.id, "person.rename", `user/${userId}`, { name: clean });
}

/**
 * Removes someone from warbag: their sign-ins, groups, grants and share
 * links go with them. Admins can't remove themselves.
 */
export async function removePerson(actor: Actor, userId: string): Promise<void> {
  requireAdmin(actor);
  if (userId === actor.id) throw new InputError("You can't remove yourself.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Kids' lists go to another of the kid's parents, if there is one.
    await client.query(
      `update gyfte_lists l set owner_id = (
         select p.user_id from gyfte_list_kids lk join gyfte_kid_parents p on p.kid_id = lk.kid_id
         where lk.list_id = l.id and p.user_id <> $1 order by p.added_at limit 1)
       where l.owner_id = $1 and exists (
         select 1 from gyfte_list_kids lk join gyfte_kid_parents p on p.kid_id = lk.kid_id
         where lk.list_id = l.id and p.user_id <> $1)`,
      [userId],
    );
    // Other Gyfte lists they manage move to the admin removing them instead
    // of being deleted. Lists that were for them keep their name but are no
    // longer tied to an account.
    const moved = await client.query("update gyfte_lists set owner_id = $2, updated_at = now() where owner_id = $1", [
      userId,
      actor.id,
    ]);
    // Mosey trips they organize move to the admin too, with their plans,
    // expenses, payments and statements; nothing about the trip is lost.
    const trips = await client.query("update mosey_trips set owner_id = $2, updated_at = now() where owner_id = $1", [userId, actor.id]);
    const { rows } = await client.query<{ email: string }>(`delete from "user" where id = $1 returning email`, [userId]);
    if (rows[0]) {
      await audit(client, actor.id, "person.remove", `user/${userId}`, {
        email: rows[0].email,
        gyfteListsMovedToActor: moved.rowCount ?? 0,
        moseyTripsMovedToActor: trips.rowCount ?? 0,
      });
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/** What removing someone would change, for the confirmation text. */
export async function removalImpact(actor: Actor, userId: string): Promise<{ lists: number; claims: number; trips: number }> {
  requireAdmin(actor);
  const { rows } = await pool.query<{ lists: number; claims: number; trips: number }>(
    `select (select count(*)::int from gyfte_lists where owner_id = $1) as lists,
            (select count(*)::int from gyfte_claims where claimer_id = $1 and item_id is not null) as claims,
            (select count(*)::int from mosey_trips where owner_id = $1) as trips`,
    [userId],
  );
  return rows[0];
}

/** Sets exactly which apps are given to this person directly. */
export async function setPersonApps(actor: Actor, userId: string, apps: string[]): Promise<void> {
  const as = manager(actor);
  await checkTarget(actor, userId);
  const want = new Set(checkAppIds(apps));
  const person = await getPerson(actor, userId);
  if (!person) throw new InputError("That person isn't on warbag anymore.");
  const have = new Set(person.apps);
  for (const app of want) if (!have.has(app)) await grantApp(as, app, { userId });
  for (const app of have) if (!want.has(app)) await revokeApp(as, app, { userId });
}

/** Sets exactly which groups this person is in. */
export async function setPersonGroups(actor: Actor, userId: string, groupIds: string[]): Promise<void> {
  const as = manager(actor);
  await checkTarget(actor, userId);
  const want = new Set(groupIds);
  for (const id of want) if (!UUID.test(id)) throw new InputError("Unknown group.");
  const person = await getPerson(actor, userId);
  if (!person) throw new InputError("That person isn't on warbag anymore.");
  const have = new Set(person.groupIds);
  for (const id of want) if (!have.has(id)) await addToGroup(as, id, userId);
  for (const id of have) if (!want.has(id)) await removeFromGroup(as, id, userId);
}

// ---------------------------------------------------------------- groups

export type GroupRow = { id: string; name: string; members: number };

export async function listGroups(actor: Actor): Promise<GroupRow[]> {
  manager(actor);
  const { rows } = await pool.query(
    `select g.id, g.name, count(m.user_id)::int as members
     from groups g left join group_members m on m.group_id = g.id
     group by g.id order by lower(g.name)`,
  );
  return rows;
}

export type Group = { id: string; name: string; memberIds: string[]; apps: string[] };

export async function getGroup(actor: Actor, groupId: string): Promise<Group | null> {
  manager(actor);
  if (!UUID.test(groupId)) return null;
  const { rows } = await pool.query(
    `select g.id, g.name,
       coalesce((select array_agg(user_id) from group_members where group_id = g.id), '{}') as "memberIds",
       coalesce((select array_agg(app) from app_grants where group_id = g.id), '{}') as apps
     from groups g where g.id = $1`,
    [groupId],
  );
  return rows[0] ?? null;
}

export async function renameGroup(actor: Actor, groupId: string, name: string): Promise<void> {
  manager(actor);
  const clean = cleanName(name);
  if (!clean) throw new InputError("Give the group a name.");
  await pool.query("update groups set name = $2 where id = $1", [groupId, clean]);
  await audit(pool, actor.id, "group.rename", `group/${groupId}`, { name: clean });
}

/** Sets exactly who is in a group. */
export async function setGroupMembers(actor: Actor, groupId: string, userIds: string[]): Promise<void> {
  const as = manager(actor);
  const group = await getGroup(actor, groupId);
  if (!group) throw new InputError("That group doesn't exist anymore.");
  const want = new Set(userIds);
  const have = new Set(group.memberIds);
  const adding = [...want].filter((id) => !have.has(id));
  const removing = [...have].filter((id) => !want.has(id));
  for (const id of [...adding, ...removing]) await checkTarget(actor, id);
  for (const id of adding) await addToGroup(as, groupId, id);
  for (const id of removing) await removeFromGroup(as, groupId, id);
}

/** Sets exactly which apps everyone in a group can use. */
export async function setGroupApps(actor: Actor, groupId: string, apps: string[]): Promise<void> {
  const as = manager(actor);
  const group = await getGroup(actor, groupId);
  if (!group) throw new InputError("That group doesn't exist anymore.");
  if (!actor.isAdmin && group.memberIds.includes(actor.id)) throw new AccessDenied("People managers can't change apps for a group they're in");
  const want = new Set(checkAppIds(apps));
  const have = new Set(group.apps);
  for (const app of want) if (!have.has(app)) await grantApp(as, app, { groupId });
  for (const app of have) if (!want.has(app)) await revokeApp(as, app, { groupId });
}

/** Creates a group. Admins and people managers. */
export async function newGroup(actor: Actor, name: string): Promise<string> {
  const as = manager(actor);
  return createGroup(as, name);
}

/** Makes someone a people manager, or not. Admins only, never themselves. */
export async function setPeopleManager(actor: Actor, userId: string, on: boolean): Promise<void> {
  requireAdmin(actor);
  if (userId === actor.id) throw new InputError("You're an admin already.");
  await pool.query(`update "user" set "isPeopleManager" = $2, "updatedAt" = now() where id = $1`, [userId, on]);
  await audit(pool, actor.id, on ? "person.peopleManager.on" : "person.peopleManager.off", `user/${userId}`);
}

export { AccessDenied };
