import "server-only";
import { pool } from "../db";
import { InputError } from "../errors";
import {
  createShareLink,
  grantItem,
  groupsFor,
  listItemGrants,
  listShareLinks,
  resolveShareLink,
  revokeItem,
  revokeShareLink,
  type Actor,
  type ItemRef,
} from "../access";
import { displayName, listWithRole, type Item } from "./data";
import { isPast, listTitle, type Occasion } from "./occasions";

/**
 * Sharing a Gyfte list. Two levels:
 *   contribute  "See and claim"  (the usual: family)
 *   manage      "Can edit"       (a partner or other parent)
 * People pick from their own groups and the people in them (admins: all),
 * so sharing never reveals who else is on warbag.
 */

const ref = (list: { id: string; owner_id: string }): ItemRef => ({
  app: "gyfte",
  type: "list",
  id: list.id,
  ownerId: list.owner_id,
});

export type Grantee = { kind: "group" | "person"; id: string; name: string; canEdit: boolean };

export type Sharing = {
  shared: Grantee[];
  groups: { id: string; name: string }[];
  people: { id: string; name: string }[];
  links: { id: string; token: string }[];
  /** The owner's most recent other list's sharing, offered as one tap. */
  suggestion: { from: string; names: string[] } | null;
};

/** People the actor may share with: everyone in their groups (admins: all). */
async function shareablePeople(actor: Actor, ownerId: string) {
  const { rows } = await pool.query<{ id: string; name: string; email: string }>(
    actor.isAdmin
      ? `select id, name, email from "user" where id <> $1 and not "isGuest" order by lower(coalesce(nullif(name, ''), email))`
      : `select distinct u.id, u.name, u.email from "user" u
         join group_members m on m.user_id = u.id
         where m.group_id in (select group_id from group_members where user_id = $1) and u.id <> $1
         order by 1`,
    [actor.id],
  );
  return rows.filter((r) => r.id !== ownerId).map((r) => ({ id: r.id, name: displayName(r.name, r.email) }));
}

async function lastSharedList(actor: Actor, list: { id: string; owner_id: string }) {
  const { rows } = await pool.query<{ id: string; recipient_name: string; occasion: Occasion; d: string }>(
    `select l.id, l.recipient_name, l.occasion, to_char(l.occasion_date, 'YYYY-MM-DD') as d
     from gyfte_lists l
     where l.owner_id = $1 and l.id <> $2
       and exists (select 1 from item_grants g where g.app = 'gyfte' and g.item_type = 'list' and g.item_id = l.id::text)
     order by l.created_at desc limit 1`,
    [list.owner_id, list.id],
  );
  return rows[0] ?? null;
}

export async function sharingFor(actor: Actor, listId: string): Promise<Sharing> {
  const { list } = await listWithRole(actor, listId, "manage");
  const grants = await listItemGrants(actor, ref(list));
  const shared: Grantee[] = grants.map((g) =>
    g.groupId
      ? { kind: "group", id: g.groupId, name: g.groupName ?? "Group", canEdit: g.role === "manage" }
      : { kind: "person", id: g.userId!, name: displayName(null, g.email ?? ""), canEdit: g.role === "manage" },
  );
  // Show people by name where we know it.
  const people = await shareablePeople(actor, list.owner_id);
  const names = new Map(people.map((p) => [p.id, p.name]));
  for (const s of shared) if (s.kind === "person" && names.has(s.id)) s.name = names.get(s.id)!;

  let suggestion: Sharing["suggestion"] = null;
  if (shared.length === 0) {
    const prev = await lastSharedList(actor, list);
    if (prev) {
      const prevGrants = await listItemGrants(actor, ref({ id: prev.id, owner_id: list.owner_id })).catch(() => []);
      if (prevGrants.length > 0) {
        suggestion = {
          from: listTitle(prev.recipient_name, prev.occasion, prev.d),
          names: prevGrants.map((g) => g.groupName ?? names.get(g.userId ?? "") ?? displayName(null, g.email ?? "")),
        };
      }
    }
  }

  const links = (await listShareLinks(actor, ref(list))).map((l) => ({ id: l.id, token: l.token }));
  return { shared, groups: await groupsFor(actor), people, links, suggestion };
}

/**
 * Sets exactly who the list is shared with. `editors` is the subset of
 * people who can also edit. Choices outside what the actor may share with
 * are refused.
 */
export async function setSharing(
  actor: Actor,
  listId: string,
  input: { groupIds: string[]; userIds: string[]; editorIds: string[] },
): Promise<void> {
  const { list } = await listWithRole(actor, listId, "manage");
  const allowedGroups = new Set((await groupsFor(actor)).map((g) => g.id));
  const allowedPeople = new Set((await shareablePeople(actor, list.owner_id)).map((p) => p.id));
  const groupIds = [...new Set(input.groupIds)];
  const userIds = [...new Set(input.userIds)];
  for (const id of groupIds) if (!allowedGroups.has(id)) throw new InputError("You can only share with your own groups.");
  for (const id of userIds) if (!allowedPeople.has(id)) throw new InputError("You can only share with people in your groups.");
  const editors = new Set(input.editorIds.filter((id) => userIds.includes(id)));

  const r = ref(list);
  const current = await listItemGrants(actor, r);
  for (const g of current) {
    const keep = g.groupId ? groupIds.includes(g.groupId) : userIds.includes(g.userId!);
    if (!keep) await revokeItem(actor, r, g.groupId ? { groupId: g.groupId } : { userId: g.userId! });
  }
  for (const id of groupIds) await grantItem(actor, r, { groupId: id }, "contribute");
  for (const id of userIds) await grantItem(actor, r, { userId: id }, editors.has(id) ? "manage" : "contribute");
}

/** One tap: share this list the same way as the owner's last shared list. */
export async function shareLikeLast(actor: Actor, listId: string): Promise<void> {
  const { list } = await listWithRole(actor, listId, "manage");
  const prev = await lastSharedList(actor, list);
  if (!prev) throw new InputError("There's no earlier list to copy sharing from.");
  const grants = await listItemGrants(actor, ref({ id: prev.id, owner_id: list.owner_id }));
  await setSharing(actor, listId, {
    groupIds: grants.filter((g) => g.groupId).map((g) => g.groupId!),
    userIds: grants.filter((g) => g.userId).map((g) => g.userId!),
    editorIds: grants.filter((g) => g.userId && g.role === "manage").map((g) => g.userId!),
  });
}

// ---------------------------------------------------------------- links

export async function createListLink(actor: Actor, listId: string): Promise<void> {
  const { list } = await listWithRole(actor, listId, "manage");
  // View only: links never claim, and never show claims.
  await createShareLink(actor, ref(list), { role: "view" });
}

export async function revokeListLink(actor: Actor, listId: string, linkId: string): Promise<void> {
  const { list } = await listWithRole(actor, listId, "manage");
  await revokeShareLink(actor, ref(list), linkId);
}

export type PublicList = {
  title: string;
  occasionDate: string;
  past: boolean;
  items: Omit<Item, "claim" | "receivedAt">[];
};

/**
 * What a share link shows: the list's wanted gifts, with no claim
 * information at all (whoever opens it might be the person it's for).
 */
export async function listByLink(token: string): Promise<PublicList | null> {
  const link = await resolveShareLink(token);
  if (!link || link.app !== "gyfte" || link.type !== "list") return null;
  const { rows } = await pool.query(
    `select recipient_name, occasion, to_char(occasion_date, 'YYYY-MM-DD') as d from gyfte_lists where id::text = $1`,
    [link.id],
  );
  if (!rows[0]) return null;
  const items = await pool.query(
    `select id, name, notes, size, color, price, links, starred from gyfte_items
     where list_id::text = $1 and received_at is null order by starred desc, position asc`,
    [link.id],
  );
  return {
    title: listTitle(rows[0].recipient_name, rows[0].occasion, rows[0].d),
    occasionDate: rows[0].d,
    past: isPast(rows[0].d, new Date().toISOString().slice(0, 10)),
    items: items.rows,
  };
}
