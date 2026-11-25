import "server-only";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { AccessDenied, audit, canUseApp, type Actor } from "../access";
import { InputError } from "../errors";
import { cleanFields, notesInStickiesFile, TRASH_DAYS, type Note, type NoteFields, type RemindBy } from "./note";

/**
 * Jot notes on the server. Who may do what:
 * - Using Jot needs app access (admins always have it).
 * - A note is private to its owner: only they see, change, trash or
 *   restore it. Admins don't see other people's notes. No sharing yet.
 * Refusals are AccessDenied, which pages show as "not found".
 */

export const APP = "jot";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_NOTES = 5000;
const MAX_IMPORT_BYTES = 2_000_000;

type Row = {
  id: string;
  owner_id: string;
  body: string;
  colour: Note["colour"];
  importance: Note["importance"];
  remind_at: Date | null;
  remind_by: RemindBy;
  reminded_at: Date | null;
  position: number;
  created_at: Date;
  updated_at: Date;
  trashed_at: Date | null;
};

const COLUMNS = "id, owner_id, body, colour, importance, remind_at, remind_by, reminded_at, position, created_at, updated_at, trashed_at";

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const toNote = (r: Row): Note => ({
  id: r.id,
  body: r.body,
  colour: r.colour,
  importance: r.importance,
  remindAt: iso(r.remind_at),
  remindBy: r.remind_by,
  remindedAt: iso(r.reminded_at),
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
  trashedAt: iso(r.trashed_at),
});

export async function canUseJot(actor: Actor): Promise<boolean> {
  return canUseApp(actor, APP);
}

async function requireApp(actor: Actor) {
  if (!(await canUseJot(actor))) throw new AccessDenied();
}

/** The note if this person owns it and still has app access, else AccessDenied. */
async function own(actor: Actor, id: string, db: Pick<PoolClient, "query"> = pool): Promise<Row> {
  await requireApp(actor);
  if (!UUID.test(id)) throw new AccessDenied();
  const { rows } = await db.query<Row>(`select ${COLUMNS} from jot_notes where id = $1`, [id]);
  const r = rows[0];
  if (!r || r.owner_id !== actor.id) throw new AccessDenied();
  return r;
}

/** Deletes this person's notes that have been in the Trash for 30 days. */
async function purge(actor: Actor) {
  await pool.query(`delete from jot_notes where owner_id = $1 and trashed_at < now() - make_interval(days => $2)`, [actor.id, TRASH_DAYS]);
}

/** This person's notes on the board, in their order. */
export async function notesFor(actor: Actor): Promise<Note[]> {
  await requireApp(actor);
  const { rows } = await pool.query<Row>(
    `select ${COLUMNS} from jot_notes where owner_id = $1 and trashed_at is null order by position, created_at desc`,
    [actor.id],
  );
  return rows.map(toNote);
}

/** This person's Trash, most recently deleted first. Anything past 30 days is deleted first. */
export async function trashFor(actor: Actor): Promise<Note[]> {
  await requireApp(actor);
  await purge(actor);
  const { rows } = await pool.query<Row>(
    `select ${COLUMNS} from jot_notes where owner_id = $1 and trashed_at is not null order by trashed_at desc`,
    [actor.id],
  );
  return rows.map(toNote);
}

export async function trashCount(actor: Actor): Promise<number> {
  await requireApp(actor);
  const { rows } = await pool.query<{ n: number }>(
    `select count(*)::int as n from jot_notes where owner_id = $1 and trashed_at >= now() - make_interval(days => $2)`,
    [actor.id, TRASH_DAYS],
  );
  return rows[0].n;
}

/** One note of this person's, on the board or in the Trash. */
export async function getNote(actor: Actor, id: string): Promise<Note> {
  const r = await own(actor, id);
  if (r.trashed_at && r.trashed_at.getTime() < Date.now() - TRASH_DAYS * 86_400_000) throw new AccessDenied();
  return toNote(r);
}

async function roomFor(actor: Actor, adding: number) {
  const { rows } = await pool.query<{ n: number }>("select count(*)::int as n from jot_notes where owner_id = $1", [actor.id]);
  if (rows[0].n + adding > MAX_NOTES) throw new InputError(`You can keep up to ${MAX_NOTES.toLocaleString("en-US")} notes. Empty the Trash or delete some first.`);
}

/** The position just above everything on this person's board. */
async function topPosition(db: Pick<PoolClient, "query">, actor: Actor): Promise<number> {
  const { rows } = await db.query<{ p: number | null }>("select min(position) as p from jot_notes where owner_id = $1 and trashed_at is null", [actor.id]);
  return (rows[0].p ?? 1) - 1;
}

/** A reminder already in the past when it's set is marked as sent, so it never goes out late. */
const sentIfPast = (remindAt: string | null) => (remindAt && Date.parse(remindAt) <= Date.now() ? "now()" : "null");

/** A new note at the top of the board. Returns its id. */
export async function createNote(actor: Actor, raw: unknown): Promise<string> {
  await requireApp(actor);
  await roomFor(actor, 1);
  const f = cleanFields(raw);
  const { rows } = await pool.query<{ id: string }>(
    `insert into jot_notes (owner_id, body, colour, importance, remind_at, remind_by, reminded_at, position)
     values ($1, $2, $3, $4, $5, $6, ${sentIfPast(f.remindAt)}, $7) returning id`,
    [actor.id, f.body, f.colour, f.importance, f.remindAt, f.remindBy, await topPosition(pool, actor)],
  );
  await audit(pool, actor.id, "jot.note.create", `${APP}/note/${rows[0].id}`);
  return rows[0].id;
}

/**
 * Saves the whole note as the page has it. A changed reminder time is
 * sent again when it comes round; an unchanged one isn't. Notes in the
 * Trash can't be changed (restore first).
 */
export async function saveNote(actor: Actor, id: string, raw: unknown): Promise<NoteFields> {
  const r = await own(actor, id);
  if (r.trashed_at) throw new InputError("This note is in the Trash. Restore it to change it.");
  const f = cleanFields(raw);
  const timeChanged = (r.remind_at?.toISOString() ?? null) !== f.remindAt;
  await pool.query(
    `update jot_notes set body = $2, colour = $3, importance = $4, remind_at = $5, remind_by = $6,
       reminded_at = ${timeChanged ? sentIfPast(f.remindAt) : "reminded_at"}, updated_at = now()
     where id = $1`,
    [r.id, f.body, f.colour, f.importance, f.remindAt, f.remindBy],
  );
  return f;
}

/** Moves a note to the Trash, where it stays 30 days. No reminder goes out from the Trash. */
export async function trashNote(actor: Actor, id: string): Promise<void> {
  const r = await own(actor, id);
  if (r.trashed_at) return;
  await pool.query("update jot_notes set trashed_at = now() where id = $1", [r.id]);
  await audit(pool, actor.id, "jot.note.trash", `${APP}/note/${r.id}`);
}

/** Back to the top of the board, as it was. A reminder that passed while it was in the Trash isn't sent. */
export async function restoreNote(actor: Actor, id: string): Promise<void> {
  const r = await own(actor, id);
  if (!r.trashed_at) return;
  if (r.trashed_at.getTime() < Date.now() - TRASH_DAYS * 86_400_000) throw new AccessDenied();
  await roomFor(actor, 0);
  await pool.query(
    `update jot_notes set trashed_at = null, position = $2,
       reminded_at = case when reminded_at is null and remind_at <= now() then now() else reminded_at end
     where id = $1`,
    [r.id, await topPosition(pool, actor)],
  );
  await audit(pool, actor.id, "jot.note.restore", `${APP}/note/${r.id}`);
}

/** Deletes everything in this person's Trash for good. */
export async function emptyTrash(actor: Actor): Promise<number> {
  await requireApp(actor);
  const { rowCount } = await pool.query("delete from jot_notes where owner_id = $1 and trashed_at is not null", [actor.id]);
  await audit(pool, actor.id, "jot.trash.empty", `${APP}/note`, { count: rowCount ?? 0 });
  return rowCount ?? 0;
}

/** Swaps a note with its neighbour on the board. */
export async function moveNote(actor: Actor, id: string, direction: "up" | "down"): Promise<void> {
  const r = await own(actor, id);
  if (r.trashed_at) throw new InputError("This note is in the Trash. Restore it to move it.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    // Lock this person's board so two moves can't cross.
    const { rows } = await client.query<{ id: string; position: number }>(
      "select id, position from jot_notes where owner_id = $1 and trashed_at is null order by position, created_at desc for update",
      [actor.id],
    );
    const i = rows.findIndex((n) => n.id === r.id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < rows.length) {
      // Renumber the whole board so equal positions can't stall a move.
      [rows[i], rows[j]] = [rows[j], rows[i]];
      for (let k = 0; k < rows.length; k++) {
        if (rows[k].position !== k) await client.query("update jot_notes set position = $2 where id = $1", [rows[k].id, k]);
      }
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Adds every note in an old Stickies file (notes.json or trash.json) as a
 * new note of this person's, above what's on the board, in the file's
 * order. Deleted notes go to the Trash with their days left; ones past 30
 * days are skipped. Reminders already past aren't sent. Importing twice
 * makes copies, never overwrites. All or nothing.
 */
export async function importStickies(actor: Actor, text: string): Promise<{ board: number; trash: number; skipped: number }> {
  await requireApp(actor);
  if (text.length > MAX_IMPORT_BYTES) throw new InputError("That file is too big to be a Stickies notes file.");
  const notes = notesInStickiesFile(text);
  const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
  const keep = notes.filter((n) => !n.trashedAt || Date.parse(n.trashedAt) > cutoff);
  await roomFor(actor, keep.length);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select 1 from jot_notes where owner_id = $1 for update", [actor.id]);
    const top = await topPosition(client, actor);
    for (const [i, n] of keep.entries()) {
      await client.query(
        `insert into jot_notes (owner_id, body, colour, importance, remind_at, remind_by, reminded_at, position, created_at, updated_at, trashed_at)
         values ($1, $2, $3, $4, $5, $6, case when $5::timestamptz <= now() then now() end, $7, coalesce($8::timestamptz, now()), now(), $9)`,
        [actor.id, n.body, n.colour, n.importance, n.remindAt, n.remindBy, top - keep.length + i, n.createdAt, n.trashedAt],
      );
    }
    const trash = keep.filter((n) => n.trashedAt).length;
    await audit(client, actor.id, "jot.note.import", `${APP}/note`, { count: keep.length });
    await client.query("commit");
    return { board: keep.length - trash, trash, skipped: notes.length - keep.length };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
