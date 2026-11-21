import "server-only";
import ExcelJS from "exceljs";
import { pool } from "../db";
import { InputError } from "../errors";
import { AccessDenied, type Actor } from "../access";
import { canUseGyfte } from "./data";
import { readGiftSheet, type SheetImport } from "./sheet-import";

/**
 * Spreadsheet import, in two steps:
 *   1. upload: the file is read into a private draft (only its owner sees it)
 *   2. apply: the owner's reviewed choices become lists they own
 * The file itself isn't stored. Imported lists are private until shared.
 */

export const IMPORT_MAX_BYTES = 900_000; // under the 1 MB form limit
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createImportDraft(actor: Actor, fileName: string, bytes: ArrayBuffer): Promise<string> {
  if (!(await canUseGyfte(actor))) throw new AccessDenied();
  if (bytes.byteLength === 0) throw new InputError("Choose a file first.");
  if (bytes.byteLength > IMPORT_MAX_BYTES) throw new InputError("That file is too big. Gift sheets are usually well under 1 MB.");

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(bytes);
  } catch {
    throw new InputError("That file couldn't be read. In Google Sheets, use File, Download, Microsoft Excel (.xlsx).");
  }
  const sheet = readGiftSheet(wb);
  if (sheet.lists.length === 0) {
    throw new InputError("No gift lists found. Each person's tab needs a header row like Gift / Idea, Description, Size, Color, Location.");
  }

  // One open draft at a time per person.
  await pool.query("delete from gyfte_imports where owner_id = $1 and applied_at is null", [actor.id]);
  const { rows } = await pool.query<{ id: string }>(
    "insert into gyfte_imports (owner_id, file_name, data) values ($1, $2, $3) returning id",
    [actor.id, fileName.slice(0, 200), JSON.stringify(sheet)],
  );
  return rows[0].id;
}

export type ImportDraft = {
  id: string;
  fileName: string;
  createdAt: Date;
  appliedAt: Date | null;
  sheet: SheetImport;
  /** List keys ("Kim|2024") that already exist as lists, and will be skipped. */
  existing: string[];
};

async function loadDraft(actor: Actor, id: string) {
  if (!UUID.test(id)) throw new AccessDenied();
  const { rows } = await pool.query(
    `select id, owner_id, file_name as "fileName", created_at as "createdAt", applied_at as "appliedAt", data
     from gyfte_imports where id = $1`,
    [id],
  );
  if (!rows[0] || rows[0].owner_id !== actor.id) throw new AccessDenied();
  return rows[0] as { id: string; fileName: string; createdAt: Date; appliedAt: Date | null; data: SheetImport };
}

/** Lists this person already owns for the same person and Christmas. */
async function existingKeys(actor: Actor, sheet: SheetImport): Promise<Set<string>> {
  const { rows } = await pool.query<{ name: string; year: number }>(
    `select lower(recipient_name) as name, extract(year from occasion_date)::int as year
     from gyfte_lists where owner_id = $1 and occasion = 'christmas'`,
    [actor.id],
  );
  const have = new Set(rows.map((r) => `${r.name}|${r.year}`));
  return new Set(sheet.lists.filter((l) => have.has(`${l.person.toLowerCase()}|${l.year}`)).map((l) => l.key));
}

export async function getImportDraft(actor: Actor, id: string): Promise<ImportDraft> {
  const d = await loadDraft(actor, id);
  return {
    id: d.id,
    fileName: d.fileName,
    createdAt: d.createdAt,
    appliedAt: d.appliedAt,
    sheet: d.data,
    existing: [...(await existingKeys(actor, d.data))],
  };
}

/** The person's open (not yet imported) draft, if any. */
export async function openDraftId(actor: Actor): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    "select id from gyfte_imports where owner_id = $1 and applied_at is null order by created_at desc limit 1",
    [actor.id],
  );
  return rows[0]?.id ?? null;
}

export async function discardImportDraft(actor: Actor, id: string): Promise<void> {
  await loadDraft(actor, id);
  await pool.query("delete from gyfte_imports where id = $1 and applied_at is null", [id]);
}

/**
 * Creates the reviewed lists: Christmas of each year, owned by the importer.
 * `keep` is the set of ticked rows; `me` is the tab that is the importer
 * (their lists are marked as for them). Lists that already exist are
 * skipped, so applying twice can't duplicate anything.
 */
export async function applyImportDraft(
  actor: Actor,
  id: string,
  choices: { keep: string[]; me: string | null },
): Promise<{ lists: number; gifts: number }> {
  const d = await loadDraft(actor, id);
  if (d.appliedAt) throw new InputError("This import is already done.");
  const keep = new Set(choices.keep);
  const existing = await existingKeys(actor, d.data);
  const people = new Set(d.data.lists.map((l) => l.person));
  const me = choices.me && people.has(choices.me) ? choices.me : null;

  const client = await pool.connect();
  let lists = 0;
  let gifts = 0;
  try {
    await client.query("begin");
    for (const list of d.data.lists) {
      if (existing.has(list.key)) continue;
      const items = list.items.filter((i) => keep.has(i.key));
      if (items.length === 0) continue;
      const date = `${list.year}-12-25`;
      const { rows } = await client.query<{ id: string }>(
        `insert into gyfte_lists (owner_id, recipient_user_id, recipient_name, occasion, occasion_date)
         values ($1, $2, $3, 'christmas', $4) returning id`,
        [actor.id, list.person === me ? actor.id : null, list.person.slice(0, 80), date],
      );
      for (const [i, item] of items.entries()) {
        await client.query(
          `insert into gyfte_items (list_id, name, notes, size, color, price, links, position, received_at, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            rows[0].id,
            item.name,
            item.notes,
            item.size,
            item.color,
            item.price,
            item.links,
            i,
            item.received ? `${date}T12:00:00Z` : null,
            actor.id,
          ],
        );
      }
      lists += 1;
      gifts += items.length;
    }
    await client.query("update gyfte_imports set applied_at = now() where id = $1", [id]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
  return { lists, gifts };
}
