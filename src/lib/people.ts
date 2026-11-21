import "server-only";
import { randomUUID } from "node:crypto";
import { pool } from "./db";
import {
  AccessDenied,
  addToGroup,
  audit,
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
 * Admin-only management of people, groups and app access. Every function
 * checks the actor is an admin itself, so screens can't skip the check.
 */

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

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
  groups: string[];
  lastSignIn: Date | null;
};

export async function listPeople(actor: Actor): Promise<PersonRow[]> {
  requireAdmin(actor);
  const { rows } = await pool.query(
    `select u.id, u.email, u.name, u."isAdmin",
       coalesce(array_agg(distinct g.name) filter (where g.name is not null), '{}') as groups,
       (select max(s."createdAt") from "session" s where s."userId" = u.id) as "lastSignIn"
     from "user" u
     left join group_members m on m.user_id = u.id
     left join groups g on g.id = m.group_id
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
  groupIds: string[];
  apps: string[];
};

/** One person, with their groups and the apps given to them directly. */
export async function getPerson(actor: Actor, userId: string): Promise<Person | null> {
  requireAdmin(actor);
  const { rows } = await pool.query(
    `select u.id, u.email, u.name, u."isAdmin",
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
  requireAdmin(actor);
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
  requireAdmin(actor);
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
  const { rows } = await pool.query<{ email: string }>(`delete from "user" where id = $1 returning email`, [userId]);
  if (rows[0]) await audit(pool, actor.id, "person.remove", `user/${userId}`, { email: rows[0].email });
}

/** Sets exactly which apps are given to this person directly. */
export async function setPersonApps(actor: Actor, userId: string, apps: string[]): Promise<void> {
  requireAdmin(actor);
  const want = new Set(checkAppIds(apps));
  const person = await getPerson(actor, userId);
  if (!person) throw new InputError("That person isn't on warbag anymore.");
  const have = new Set(person.apps);
  for (const app of want) if (!have.has(app)) await grantApp(actor, app, { userId });
  for (const app of have) if (!want.has(app)) await revokeApp(actor, app, { userId });
}

/** Sets exactly which groups this person is in. */
export async function setPersonGroups(actor: Actor, userId: string, groupIds: string[]): Promise<void> {
  requireAdmin(actor);
  const want = new Set(groupIds);
  for (const id of want) if (!UUID.test(id)) throw new InputError("Unknown group.");
  const person = await getPerson(actor, userId);
  if (!person) throw new InputError("That person isn't on warbag anymore.");
  const have = new Set(person.groupIds);
  for (const id of want) if (!have.has(id)) await addToGroup(actor, id, userId);
  for (const id of have) if (!want.has(id)) await removeFromGroup(actor, id, userId);
}

// ---------------------------------------------------------------- groups

export type GroupRow = { id: string; name: string; members: number };

export async function listGroups(actor: Actor): Promise<GroupRow[]> {
  requireAdmin(actor);
  const { rows } = await pool.query(
    `select g.id, g.name, count(m.user_id)::int as members
     from groups g left join group_members m on m.group_id = g.id
     group by g.id order by lower(g.name)`,
  );
  return rows;
}

export type Group = { id: string; name: string; memberIds: string[]; apps: string[] };

export async function getGroup(actor: Actor, groupId: string): Promise<Group | null> {
  requireAdmin(actor);
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
  requireAdmin(actor);
  const clean = cleanName(name);
  if (!clean) throw new InputError("Give the group a name.");
  await pool.query("update groups set name = $2 where id = $1", [groupId, clean]);
  await audit(pool, actor.id, "group.rename", `group/${groupId}`, { name: clean });
}

/** Sets exactly who is in a group. */
export async function setGroupMembers(actor: Actor, groupId: string, userIds: string[]): Promise<void> {
  requireAdmin(actor);
  const group = await getGroup(actor, groupId);
  if (!group) throw new InputError("That group doesn't exist anymore.");
  const want = new Set(userIds);
  const have = new Set(group.memberIds);
  for (const id of want) if (!have.has(id)) await addToGroup(actor, groupId, id);
  for (const id of have) if (!want.has(id)) await removeFromGroup(actor, groupId, id);
}

/** Sets exactly which apps everyone in a group can use. */
export async function setGroupApps(actor: Actor, groupId: string, apps: string[]): Promise<void> {
  requireAdmin(actor);
  const group = await getGroup(actor, groupId);
  if (!group) throw new InputError("That group doesn't exist anymore.");
  const want = new Set(checkAppIds(apps));
  const have = new Set(group.apps);
  for (const app of want) if (!have.has(app)) await grantApp(actor, app, { groupId });
  for (const app of have) if (!want.has(app)) await revokeApp(actor, app, { groupId });
}

export { AccessDenied };
