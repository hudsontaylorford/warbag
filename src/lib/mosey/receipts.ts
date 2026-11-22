import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { pool } from "../db";
import { InputError } from "../errors";
import { AccessDenied, type Actor } from "../access";
import { tripWithRole } from "./trips";
import { parseDollars } from "./money";
import { PERSONAL_DOCUMENT_WARNING } from "./receipt-form";
import { readReceipt, receiptAiConfigured, type ReceiptDraft } from "./receipt-ai";

/**
 * Receipt photos. Members of a trip only (never view links or view grants).
 * Images go to a private Vercel Blob store and are only ever served through
 * our own route after an access check; no blob URL reaches a browser. The AI
 * suggests merchant, date, total and description; a person reviews and
 * saves the expense themselves. Manual entry always works without it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Vercel caps a request to a server function at 4.5 MB.
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** The image type from its first bytes, ignoring what the browser claimed. */
export function sniffImage(buf: Buffer): ImageType | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

// ------------------------------------------------------------ storage

/** Dev and tests only: a folder instead of Blob. Refused in production. */
function localDir(): string | null {
  const dir = process.env.RECEIPT_STORE_DIR;
  if (!dir) return null;
  if (process.env.NODE_ENV === "production") throw new Error("RECEIPT_STORE_DIR is for development and tests only.");
  return dir;
}

export function receiptsConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) || (process.env.NODE_ENV !== "production" && Boolean(process.env.RECEIPT_STORE_DIR));
}

async function store(pathname: string, body: Buffer, contentType: ImageType) {
  const dir = localDir();
  if (dir && !process.env.BLOB_READ_WRITE_TOKEN) {
    const file = path.join(dir, pathname);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }
  await put(pathname, body, { access: "private", contentType, addRandomSuffix: false });
}

async function load(pathname: string): Promise<ReadableStream<Uint8Array> | Buffer | null> {
  const dir = localDir();
  if (dir && !process.env.BLOB_READ_WRITE_TOKEN) return readFile(path.join(dir, pathname)).catch(() => null);
  const res = await get(pathname, { access: "private" });
  return res?.stream ?? null;
}

async function remove(pathname: string) {
  const dir = localDir();
  if (dir && !process.env.BLOB_READ_WRITE_TOKEN) return rm(path.join(dir, pathname), { force: true });
  await del(pathname);
}

/** Older stored drafts predate `candidates`. */
function readDraft(raw: unknown): ReceiptDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as ReceiptDraft;
  return { ...d, candidates: Array.isArray(d.candidates) ? d.candidates : [], personalDocument: d.personalDocument === true };
}

// ------------------------------------------------------------ upload and read

export type UploadResult = {
  receiptId: string;
  draft: ReceiptDraft | null;
  draftError: string | null;
  /** Plain warnings, e.g. this photo or this total is already on the trip. */
  warnings: string[];
};

export async function uploadReceipt(actor: Actor, tripId: string, image: Buffer): Promise<UploadResult> {
  const { trip } = await tripWithRole(actor, tripId, "contribute");
  if (!receiptsConfigured()) throw new InputError("Receipt photos aren't set up yet. Add the expense by hand.");
  if (image.length === 0) throw new InputError("Choose a photo of the receipt.");
  if (image.length > MAX_RECEIPT_BYTES) throw new InputError("That photo is too big (4 MB max). Try a screenshot or a smaller photo.");
  const type = sniffImage(image);
  if (!type) throw new InputError("Use a JPEG, PNG or WebP photo.");

  const sha256 = createHash("sha256").update(image).digest("hex");
  const id = randomUUID();
  const pathname = `mosey/${trip.id}/${id}.${type.split("/")[1]}`;
  await store(pathname, image, type);

  const { draft, error } = await readReceipt(image, type);
  await pool.query(
    `insert into mosey_receipts (id, trip_id, blob_path, content_type, size_bytes, sha256, draft, draft_error, uploaded_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, trip.id, pathname, type, image.length, sha256, draft ? JSON.stringify(draft) : null, error, actor.id],
  );

  const warnings: string[] = [];
  const same = await pool.query("select 1 from mosey_receipts where trip_id = $1 and sha256 = $2 and id <> $3 limit 1", [trip.id, sha256, id]);
  if (draft?.personalDocument) warnings.push(PERSONAL_DOCUMENT_WARNING);
  if (same.rowCount) warnings.push("This exact photo was uploaded before. Check it isn't already an expense.");
  const cents = draft ? parseDollars(draft.total) : null;
  if (cents && draft?.date) {
    const dup = await pool.query<{ description: string }>(
      `select description from mosey_expenses where trip_id = $1 and deleted_at is null and total_cents = $2 and spent_on = $3 limit 1`,
      [trip.id, cents, draft.date],
    );
    if (dup.rows[0]) warnings.push(`"${dup.rows[0].description}" on the same day for the same amount is already here. Check it isn't the same thing.`);
  }
  return { receiptId: id, draft, draftError: error, warnings };
}

/** Expense id -> its receipt id, for the trip's expense list. Members only. */
export async function receiptsByExpense(actor: Actor, tripId: string): Promise<Map<string, string>> {
  const { trip } = await tripWithRole(actor, tripId, "contribute");
  const { rows } = await pool.query<{ id: string; expense_id: string }>(
    "select id, expense_id from mosey_receipts where trip_id = $1 and expense_id is not null order by created_at",
    [trip.id],
  );
  return new Map(rows.map((r) => [r.expense_id, r.id]));
}

export type UnsavedReceipt = {
  receiptId: string;
  draft: ReceiptDraft | null;
  draftError: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  /** The person who uploaded it, or an organizer. */
  canDiscard: boolean;
};

/** Photos uploaded to the trip but not saved as an expense yet, newest first. Members only. */
export async function unsavedReceipts(actor: Actor, tripId: string): Promise<UnsavedReceipt[]> {
  const { trip, role } = await tripWithRole(actor, tripId, "contribute");
  const { rows } = await pool.query<{ id: string; draft: unknown; draft_error: string | null; uploaded_by: string | null; name: string | null; created_at: Date }>(
    `select r.id, r.draft, r.draft_error, r.uploaded_by, u.name, r.created_at
       from mosey_receipts r left join "user" u on u.id = r.uploaded_by
      where r.trip_id = $1 and r.expense_id is null
      order by r.created_at desc`,
    [trip.id],
  );
  return rows.map((r) => ({
    receiptId: r.id,
    draft: readDraft(r.draft),
    draftError: r.draft_error,
    uploadedBy: r.name,
    uploadedAt: r.created_at.toISOString(),
    canDiscard: role === "manage" || r.uploaded_by === actor.id,
  }));
}

/**
 * Deletes a photo that was never saved as an expense: the image and its row.
 * The person who uploaded it or an organizer. A photo already on an expense
 * stays with it.
 */
export async function discardReceipt(actor: Actor, receiptId: string): Promise<void> {
  if (!UUID.test(receiptId)) throw new AccessDenied();
  const { rows } = await pool.query<{ trip_id: string; blob_path: string; uploaded_by: string | null; expense_id: string | null }>(
    "select trip_id, blob_path, uploaded_by, expense_id from mosey_receipts where id = $1",
    [receiptId],
  );
  const r = rows[0];
  if (!r) throw new AccessDenied();
  const { role } = await tripWithRole(actor, r.trip_id, "contribute");
  if (role !== "manage" && r.uploaded_by !== actor.id) throw new AccessDenied();
  if (r.expense_id) throw new InputError("This photo is saved with an expense, so it stays.");
  // Row first, guarded so a save that just happened wins; then the image.
  const gone = await pool.query("delete from mosey_receipts where id = $1 and expense_id is null", [receiptId]);
  if (!gone.rowCount) throw new InputError("This photo is saved with an expense, so it stays.");
  await remove(r.blob_path).catch((err) => console.error("receipt image delete failed", receiptId, err));
}

/** The image, for the receipt route. Members of the trip only. */
export async function openReceipt(actor: Actor | null, receiptId: string): Promise<{ body: ReadableStream<Uint8Array> | Buffer; contentType: string }> {
  if (!actor || !UUID.test(receiptId)) throw new AccessDenied();
  const { rows } = await pool.query<{ trip_id: string; blob_path: string; content_type: string }>(
    "select trip_id, blob_path, content_type from mosey_receipts where id = $1",
    [receiptId],
  );
  if (!rows[0]) throw new AccessDenied();
  await tripWithRole(actor, rows[0].trip_id, "contribute");
  const body = await load(rows[0].blob_path);
  if (!body) throw new AccessDenied();
  return { body, contentType: rows[0].content_type };
}

export { receiptAiConfigured };
