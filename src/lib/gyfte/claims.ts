import "server-only";
import { pool } from "../db";
import { InputError } from "../errors";
import { listTitle } from "./occasions";
import { AccessDenied, claimsVisibleTo, itemWithRole } from "./data";
import { isPast } from "./occasions";
import type { Actor } from "../access";

/**
 * Claims: "I'll get this". The rules:
 * - Only people who may see claims can claim: never the person the list is
 *   for, never when the list has claims off, never on a past list.
 * - Claiming needs contribute (or manage) on the list.
 * - One active claim per item. The database enforces it, so a race has one
 *   winner; the other person is told someone just claimed it.
 * - Only the claimer can undo.
 */

const today = () => new Date().toISOString().slice(0, 10);

export async function claimItem(actor: Actor, itemId: string): Promise<void> {
  const { list } = await itemWithRole(actor, itemId, "contribute");
  if (!claimsVisibleTo(actor, list)) throw new AccessDenied();
  if (isPast(list.occasion_date, today())) throw new InputError("This list is in History, so it can't be claimed from.");

  const { rows } = await pool.query<{ name: string; received: boolean }>(
    "select name, received_at is not null as received from gyfte_items where id = $1",
    [itemId],
  );
  if (!rows[0]) throw new AccessDenied();
  if (rows[0].received) throw new InputError("They already have this one.");

  const inserted = await pool.query(
    `insert into gyfte_claims (item_id, list_id, claimer_id, item_name, list_title)
     values ($1, $2, $3, $4, $5)
     on conflict (item_id) where item_id is not null do nothing`,
    [itemId, list.id, actor.id, rows[0].name, listTitle(list.recipient_name, list.occasion, list.occasion_date)],
  );
  if (inserted.rowCount === 0) {
    const holder = await pool.query<{ claimer_id: string }>("select claimer_id from gyfte_claims where item_id = $1", [itemId]);
    if (holder.rows[0]?.claimer_id !== actor.id) throw new InputError("Someone just claimed this. Pick another gift.");
  }
}

/** Undo your own claim. Someone else's claim is left alone. */
export async function unclaimItem(actor: Actor, itemId: string): Promise<void> {
  const { list } = await itemWithRole(actor, itemId, "view");
  if (!claimsVisibleTo(actor, list)) throw new AccessDenied();
  const { rowCount } = await pool.query("delete from gyfte_claims where item_id = $1 and claimer_id = $2", [
    itemId,
    actor.id,
  ]);
  if (rowCount === 0) throw new InputError("That isn't your claim.");
}

export type MyClaim = {
  id: string;
  itemId: string | null;
  listId: string | null;
  itemName: string;
  listTitle: string;
  link: string | null;
  received: boolean;
  removed: boolean;
};

/**
 * Everything you've said you'll get, as a shopping list. A claim whose item
 * the owner deleted shows as removed until you dismiss it. Claims on lists
 * you can no longer open still show their saved name, nothing else.
 */
export async function myClaims(actor: Actor): Promise<MyClaim[]> {
  const { rows } = await pool.query(
    `select c.id, c.item_id as "itemId", c.list_id as "listId",
       coalesce(i.name, c.item_name) as "itemName", c.list_title as "listTitle",
       i.links[1] as link, i.received_at is not null as received, c.item_id is null as removed
     from gyfte_claims c left join gyfte_items i on i.id = c.item_id
     where c.claimer_id = $1
     order by c.item_id is null desc, c.list_title, c.created_at`,
    [actor.id],
  );
  return rows;
}

/** Clears a "removed" claim from My claims. Only your own, only removed ones. */
export async function dismissClaim(actor: Actor, claimId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) return;
  await pool.query("delete from gyfte_claims where id = $1 and claimer_id = $2 and item_id is null", [claimId, actor.id]);
}
