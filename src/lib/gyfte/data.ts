import "server-only";
import { pool } from "../db";
import { atLeast } from "../access/roles";
import {
  AccessDenied,
  canUseApp,
  forgetItem,
  itemsSharedWith,
  requireItemRole,
  type Actor,
  type ItemRef,
  type Role,
} from "../access";
import { InputError } from "../errors";
import { cleanLink, nameFromLink, parseLink } from "./links";
import {
  isClaimMode,
  isOccasion,
  isoDay,
  isPast,
  listTitle,
  nextBirthday,
  nextChristmas,
  parseDay,
  type ClaimMode,
  type Occasion,
} from "./occasions";

/**
 * Gyfte's data rules. Every function takes the acting person and checks
 * their level on the list through the shared access rules:
 *   view        see the list and its items
 *   manage      add, edit, star, mark received, delete, change settings
 * (contribute, for claiming, arrives with claims.) Anything refused throws
 * AccessDenied; pages turn that into "not found".
 */

const APP = "gyfte";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export { AccessDenied, InputError };

type ListRow = {
  id: string;
  owner_id: string;
  recipient_user_id: string | null;
  recipient_name: string;
  occasion: Occasion;
  occasion_date: string;
  claims_mode: ClaimMode;
};

export type ListSummary = {
  id: string;
  title: string;
  recipientName: string;
  occasion: Occasion;
  occasionDate: string;
  itemCount: number;
  mine: boolean;
};

/**
 * Claim info on an item. Only present when the viewer may see claims:
 * never for the person the list is for, never when claims are off.
 */
export type ItemClaim = { mine: boolean; by: string | null } | null;

export type Item = {
  id: string;
  name: string;
  notes: string;
  size: string;
  color: string;
  price: string;
  links: string[];
  starred: boolean;
  receivedAt: Date | null;
  claim?: ItemClaim;
};

export type ListDetail = {
  id: string;
  title: string;
  recipientName: string;
  occasion: Occasion;
  occasionDate: string;
  claimsMode: ClaimMode;
  role: Role;
  past: boolean;
  /** Whether this viewer sees claims, and may claim. False for the recipient. */
  claims: { visible: boolean; canClaim: boolean };
  items: Item[];
};

const ref = (list: Pick<ListRow, "id" | "owner_id">): ItemRef => ({
  app: APP,
  type: "list",
  id: list.id,
  ownerId: list.owner_id,
});

const today = () => isoDay(new Date());

async function loadList(listId: string): Promise<ListRow | null> {
  if (!UUID.test(listId)) return null;
  const { rows } = await pool.query<ListRow>(
    `select id, owner_id, recipient_user_id, recipient_name, occasion,
       to_char(occasion_date, 'YYYY-MM-DD') as occasion_date, claims_mode
     from gyfte_lists where id = $1`,
    [listId],
  );
  return rows[0] ?? null;
}

/** The list and the actor's level on it, or AccessDenied. */
export async function listWithRole(actor: Actor, listId: string, need: Role): Promise<{ list: ListRow; role: Role }> {
  const list = await loadList(listId);
  if (!list) throw new AccessDenied();
  const role = await requireItemRole(actor, ref(list), need);
  return { list, role };
}

/** The item's list, checked for `need`. */
export async function itemWithRole(actor: Actor, itemId: string, need: Role): Promise<{ list: ListRow; role: Role }> {
  if (!UUID.test(itemId)) throw new AccessDenied();
  const { rows } = await pool.query<{ list_id: string }>("select list_id from gyfte_items where id = $1", [itemId]);
  if (!rows[0]) throw new AccessDenied();
  return listWithRole(actor, rows[0].list_id, need);
}

function clean(raw: unknown, max: number, label: string): string {
  const text = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (text.length > max) throw new InputError(`${label} is at most ${max} characters.`);
  return text;
}

// ---------------------------------------------------------------- lists

export async function canUseGyfte(actor: Actor): Promise<boolean> {
  return canUseApp(actor, APP);
}

/** Lists this person owns or that are shared with them, current and past. */
export async function listsFor(actor: Actor): Promise<{ current: ListSummary[]; past: ListSummary[] }> {
  const shared = (await itemsSharedWith(actor, APP, "list")).map((s) => s.id);
  const { rows } = await pool.query(
    `select l.id, l.owner_id, l.recipient_name, l.occasion,
       to_char(l.occasion_date, 'YYYY-MM-DD') as occasion_date,
       (select count(*)::int from gyfte_items i where i.list_id = l.id and i.received_at is null) as item_count
     from gyfte_lists l
     where l.owner_id = $1 or l.id = any($2::uuid[])
     order by l.occasion_date asc, lower(l.recipient_name)`,
    [actor.id, shared],
  );
  const now = today();
  const all: (ListSummary & { past: boolean })[] = rows.map((r) => ({
    id: r.id,
    title: listTitle(r.recipient_name, r.occasion, r.occasion_date),
    recipientName: r.recipient_name,
    occasion: r.occasion,
    occasionDate: r.occasion_date,
    itemCount: r.item_count,
    mine: r.owner_id === actor.id,
    past: isPast(r.occasion_date, now),
  }));
  return {
    current: all.filter((l) => !l.past),
    past: all.filter((l) => l.past).reverse(),
  };
}

/**
 * Suggested date for a new list: Christmas is Dec 25; a birthday reuses
 * the month and day of this person's last birthday list, if any.
 */
export async function suggestedDate(
  actor: Actor,
  occasion: Occasion,
  recipient: { me: boolean; name: string },
): Promise<string | null> {
  const now = today();
  if (occasion === "christmas") return nextChristmas(now);
  const { rows } = await pool.query<{ d: string }>(
    `select to_char(occasion_date, 'YYYY-MM-DD') as d from gyfte_lists
     where owner_id = $1 and occasion = 'birthday'
       and (case when $2 then recipient_user_id = $1 else recipient_user_id is null and lower(recipient_name) = lower($3) end)
     order by occasion_date desc limit 1`,
    [actor.id, recipient.me, recipient.name],
  );
  return rows[0] ? nextBirthday(rows[0].d, now) : null;
}

export async function createList(
  actor: Actor,
  input: { forMe: boolean; recipientName: string; occasion: string; date: string },
): Promise<string> {
  if (!(await canUseGyfte(actor))) throw new AccessDenied();
  const name = clean(input.recipientName, 80, "Name");
  if (!name) throw new InputError(input.forMe ? "Add your name." : "Add who the list is for.");
  if (!isOccasion(input.occasion)) throw new InputError("Pick Christmas or Birthday.");
  const date = input.occasion === "christmas" && !input.date ? nextChristmas(today()) : parseDay(input.date);
  if (!date) throw new InputError("Pick the date.");

  const { rows } = await pool.query<{ id: string }>(
    `insert into gyfte_lists (owner_id, recipient_user_id, recipient_name, occasion, occasion_date)
     values ($1, $2, $3, $4, $5) returning id`,
    [actor.id, input.forMe ? actor.id : null, name, input.occasion, date],
  );
  return rows[0].id;
}

/**
 * The claim rule: everyone with access sees claims except the person the
 * list is for. Claims off means nobody sees or makes them.
 */
export function claimsVisibleTo(actor: Actor, list: Pick<ListRow, "recipient_user_id" | "claims_mode">): boolean {
  return list.claims_mode !== "off" && actor.id !== list.recipient_user_id;
}

/** "Molly" from a name, or "molly" from molly@example.com. */
export function displayName(name: string | null, email: string): string {
  return name?.trim() || email.split("@")[0];
}

export async function getList(actor: Actor, listId: string): Promise<ListDetail> {
  const { list, role } = await listWithRole(actor, listId, "view");
  const past = isPast(list.occasion_date, today());
  const { rows } = await pool.query<Item>(
    `select id, name, notes, size, color, price, links, starred, received_at as "receivedAt"
     from gyfte_items where list_id = $1
     order by (received_at is not null), starred desc, position asc`,
    [list.id],
  );

  const visible = claimsVisibleTo(actor, list);
  if (visible) {
    // Claim rows are only ever read for viewers allowed to see them.
    const claims = await pool.query<{ item_id: string; claimer_id: string; name: string; email: string }>(
      `select c.item_id, c.claimer_id, u.name, u.email
       from gyfte_claims c join "user" u on u.id = c.claimer_id
       where c.list_id = $1 and c.item_id is not null`,
      [list.id],
    );
    const byItem = new Map(claims.rows.map((c) => [c.item_id, c]));
    for (const item of rows) {
      const c = byItem.get(item.id);
      item.claim = c
        ? {
            mine: c.claimer_id === actor.id,
            by: list.claims_mode === "named" ? displayName(c.name, c.email) : null,
          }
        : null;
    }
  }

  return {
    id: list.id,
    title: listTitle(list.recipient_name, list.occasion, list.occasion_date),
    recipientName: list.recipient_name,
    occasion: list.occasion,
    occasionDate: list.occasion_date,
    claimsMode: list.claims_mode,
    role,
    past,
    claims: { visible, canClaim: visible && !past && atLeast(role, "contribute") },
    items: rows,
  };
}

export async function updateList(
  actor: Actor,
  listId: string,
  input: { recipientName?: string; date?: string; claimsMode?: string },
): Promise<void> {
  const { list } = await listWithRole(actor, listId, "manage");
  const name = input.recipientName === undefined ? list.recipient_name : clean(input.recipientName, 80, "Name");
  if (!name) throw new InputError("Add who the list is for.");
  const date = input.date === undefined ? list.occasion_date : parseDay(input.date);
  if (!date) throw new InputError("Pick a valid date.");
  const mode = input.claimsMode === undefined ? list.claims_mode : input.claimsMode;
  if (!isClaimMode(mode)) throw new InputError("Pick how claims work.");
  await pool.query(
    `update gyfte_lists set recipient_name = $2, occasion_date = $3, claims_mode = $4, updated_at = now() where id = $1`,
    [list.id, name, date, mode],
  );
}

export async function deleteList(actor: Actor, listId: string): Promise<void> {
  const { list } = await listWithRole(actor, listId, "manage");
  await forgetItem(actor, ref(list));
  await pool.query("delete from gyfte_lists where id = $1", [list.id]);
}

// ---------------------------------------------------------------- bring forward

/**
 * The last earlier list for the same person, owned by the same owner, and
 * its items that weren't received. Offered when a new list is empty.
 */
export async function previousItems(
  actor: Actor,
  listId: string,
): Promise<{ title: string; items: { id: string; name: string }[] } | null> {
  const { list } = await listWithRole(actor, listId, "manage");
  const { rows } = await pool.query(
    `select id, recipient_name, occasion, to_char(occasion_date, 'YYYY-MM-DD') as occasion_date
     from gyfte_lists
     where owner_id = $1 and id <> $2 and occasion_date < $3
       and (case when $4::text is not null then recipient_user_id = $4 else recipient_user_id is null and lower(recipient_name) = lower($5) end)
     order by occasion_date desc limit 1`,
    [list.owner_id, list.id, list.occasion_date, list.recipient_user_id, list.recipient_name],
  );
  const prev = rows[0];
  if (!prev) return null;
  const items = await pool.query<{ id: string; name: string }>(
    `select id, name from gyfte_items where list_id = $1 and received_at is null
     order by starred desc, position asc`,
    [prev.id],
  );
  if (items.rows.length === 0) return null;
  return { title: listTitle(prev.recipient_name, prev.occasion, prev.occasion_date), items: items.rows };
}

/** Copies the chosen items from the previous list. Never copies claims. */
export async function bringForward(actor: Actor, listId: string, itemIds: string[]): Promise<number> {
  const prev = await previousItems(actor, listId);
  if (!prev) return 0;
  const allowed = new Set(prev.items.map((i) => i.id));
  const ids = itemIds.filter((id) => allowed.has(id));
  if (ids.length === 0) return 0;
  const { rowCount } = await pool.query(
    `insert into gyfte_items (list_id, name, notes, size, color, price, links, starred, position, created_by)
     select $1, name, notes, size, color, price, links, starred, position, $3
     from gyfte_items where id = any($2::uuid[])`,
    [listId, ids, actor.id],
  );
  return rowCount ?? 0;
}

// ---------------------------------------------------------------- items

/** Adds from the one Add box: a link (named from its address) or a name. */
export async function addItem(actor: Actor, listId: string, text: string): Promise<string> {
  const { list } = await listWithRole(actor, listId, "manage");
  const raw = text.trim();
  if (!raw) throw new InputError("Type a gift or paste a link.");
  const isLink = parseLink(raw) !== null;
  const name = isLink ? nameFromLink(raw) : clean(raw, 200, "The name");
  const links = isLink ? [cleanLink(raw)] : [];
  const { rows } = await pool.query<{ id: string }>(
    `insert into gyfte_items (list_id, name, links, position, created_by)
     values ($1, $2, $3, coalesce((select min(position) from gyfte_items where list_id = $1), 0) - 1, $4)
     returning id`,
    [list.id, name, links, actor.id],
  );
  await touch(list.id);
  return rows[0].id;
}

export async function updateItem(
  actor: Actor,
  itemId: string,
  input: { name: string; notes: string; size: string; color: string; price: string; links: string[] },
): Promise<void> {
  const { list } = await itemWithRole(actor, itemId, "manage");
  const name = clean(input.name, 200, "The name");
  if (!name) throw new InputError("Give the gift a name.");
  const links = input.links
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      if (!parseLink(l)) throw new InputError(`"${l.slice(0, 40)}" isn't a web link.`);
      return cleanLink(l);
    });
  if (links.length > 5) throw new InputError("Up to 5 links.");
  await pool.query(
    `update gyfte_items set name = $2, notes = $3, size = $4, color = $5, price = $6, links = $7, updated_at = now()
     where id = $1`,
    [
      itemId,
      name,
      String(input.notes ?? "").trim().slice(0, 1000),
      clean(input.size, 80, "Size"),
      clean(input.color, 80, "Color"),
      clean(input.price, 40, "Price"),
      links,
    ],
  );
  await touch(list.id);
}

export async function setStarred(actor: Actor, itemId: string, starred: boolean): Promise<void> {
  const { list } = await itemWithRole(actor, itemId, "manage");
  await pool.query("update gyfte_items set starred = $2, updated_at = now() where id = $1", [itemId, starred]);
  await touch(list.id);
}

/** "Got it": received items move below the rest and stay as history. */
export async function setReceived(actor: Actor, itemId: string, received: boolean): Promise<void> {
  const { list } = await itemWithRole(actor, itemId, "manage");
  await pool.query(
    "update gyfte_items set received_at = case when $2 then now() else null end, updated_at = now() where id = $1",
    [itemId, received],
  );
  await touch(list.id);
}

export async function deleteItem(actor: Actor, itemId: string): Promise<void> {
  const { list } = await itemWithRole(actor, itemId, "manage");
  await pool.query("delete from gyfte_items where id = $1", [itemId]);
  await touch(list.id);
}

async function touch(listId: string) {
  await pool.query("update gyfte_lists set updated_at = now() where id = $1", [listId]);
}
