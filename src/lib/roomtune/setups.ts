import "server-only";
import { pool } from "../db";
import {
  AccessDenied,
  audit,
  canUseApp,
  createShareLink,
  forgetItem,
  listShareLinks,
  resolveShareLink,
  revokeShareLink,
  type Actor,
  type ItemRef,
} from "../access";
import { InputError } from "../errors";
import { cleanSetup, setupsInFile, type Setup, type SetupDoc } from "./setup";

/**
 * Room Tuner setups on the server. Who may do what:
 * - Using Room Tuner needs app access (admins always have it).
 * - A setup is private to its owner: only they open, change or delete it.
 *   Admins don't see other people's setups.
 * - The owner can make one view-only link per setup; anyone with it sees
 *   that setup, signed in or not, until it's turned off.
 * Refusals are AccessDenied, which pages show as "not found".
 */

export const APP = "roomtune";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SETUPS = 100;

type Row = { id: string; owner_id: string; name: string; doc: SetupDoc; updated_at: Date };

export type SetupSummary = { id: string; name: string; bands: number; rounds: number; updatedAt: Date };

const ref = (row: { id: string; owner_id: string }): ItemRef => ({ app: APP, type: "setup", id: row.id, ownerId: row.owner_id });
const toSetup = (row: Row): Setup => ({ ...cleanSetup(row.doc), id: row.id });

export async function canUseRoomTuner(actor: Actor): Promise<boolean> {
  return canUseApp(actor, APP);
}

async function requireApp(actor: Actor) {
  if (!(await canUseRoomTuner(actor))) throw new AccessDenied();
}

async function row(id: string): Promise<Row | null> {
  if (!UUID.test(id)) return null;
  const { rows } = await pool.query<Row>("select id, owner_id, name, doc, updated_at from roomtune_setups where id = $1", [id]);
  return rows[0] ?? null;
}

/** The setup if this person owns it and still has app access, else AccessDenied. */
async function own(actor: Actor, id: string): Promise<Row> {
  await requireApp(actor);
  const r = await row(id);
  if (!r || r.owner_id !== actor.id) throw new AccessDenied();
  return r;
}

/** This person's setups, most recently changed first. */
export async function setupsFor(actor: Actor): Promise<SetupSummary[]> {
  await requireApp(actor);
  const { rows } = await pool.query<{ id: string; name: string; bands: number; rounds: number; updated_at: Date }>(
    `select id, name, jsonb_array_length(doc->'bands') as bands, jsonb_array_length(doc->'rounds') as rounds, updated_at
     from roomtune_setups where owner_id = $1 order by updated_at desc`,
    [actor.id],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, bands: r.bands, rounds: r.rounds, updatedAt: r.updated_at }));
}

export async function getSetup(actor: Actor, id: string): Promise<Setup> {
  return toSetup(await own(actor, id));
}

async function insert(actor: Actor, doc: SetupDoc): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into roomtune_setups (owner_id, name, doc) values ($1, $2, $3) returning id",
    [actor.id, doc.name, JSON.stringify(doc)],
  );
  return rows[0].id;
}

async function roomFor(actor: Actor, adding: number) {
  const { rows } = await pool.query<{ n: number }>("select count(*)::int as n from roomtune_setups where owner_id = $1", [actor.id]);
  if (rows[0].n + adding > MAX_SETUPS) throw new InputError(`You can keep up to ${MAX_SETUPS} setups. Delete some first.`);
}

export async function createSetup(actor: Actor, raw: unknown): Promise<string> {
  await requireApp(actor);
  await roomFor(actor, 1);
  const doc = cleanSetup(raw);
  const id = await insert(actor, doc);
  await audit(pool, actor.id, "roomtune.setup.create", `${APP}/setup/${id}`);
  return id;
}

/** Replaces the whole setup with what the page sends (after cleaning it). */
export async function saveSetup(actor: Actor, id: string, raw: unknown): Promise<void> {
  const r = await own(actor, id);
  const doc = cleanSetup(raw);
  await pool.query("update roomtune_setups set name = $2, doc = $3, updated_at = now() where id = $1", [r.id, doc.name, JSON.stringify(doc)]);
}

export async function deleteSetup(actor: Actor, id: string): Promise<void> {
  const r = await own(actor, id);
  await forgetItem(actor, ref(r));
  await pool.query("delete from roomtune_setups where id = $1", [r.id]);
  await audit(pool, actor.id, "roomtune.setup.delete", `${APP}/setup/${r.id}`);
}

/**
 * Adds every setup in an export file as a new setup of this person's. Ids
 * in the file are ignored, so importing twice makes copies, never
 * overwrites. All or nothing: one bad setup stops the whole import.
 */
export async function importSetups(actor: Actor, text: string): Promise<number> {
  await requireApp(actor);
  if (text.length > 900_000) throw new InputError("That file is too big to be a Room Tuner export.");
  const docs = setupsInFile(text).map((raw, i) => {
    try {
      return cleanSetup(raw);
    } catch (e) {
      if (e instanceof InputError) throw new InputError(`Setup ${i + 1} in the file: ${e.message} Nothing was imported.`);
      throw e;
    }
  });
  await roomFor(actor, docs.length);
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const doc of docs) {
      await client.query("insert into roomtune_setups (owner_id, name, doc) values ($1, $2, $3)", [actor.id, doc.name, JSON.stringify(doc)]);
    }
    await audit(client, actor.id, "roomtune.setup.import", `${APP}/setup`, { count: docs.length });
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  return docs.length;
}

// ------------------------------------------------------------ view link

export async function setupLinks(actor: Actor, id: string): Promise<{ id: string; token: string }[]> {
  const r = await own(actor, id);
  return (await listShareLinks(actor, ref(r))).map((l) => ({ id: l.id, token: l.token }));
}

export async function createSetupLink(actor: Actor, id: string): Promise<void> {
  const r = await own(actor, id);
  if ((await listShareLinks(actor, ref(r))).length) return;
  await createShareLink(actor, ref(r), { role: "view" });
}

export async function revokeSetupLink(actor: Actor, id: string, linkId: string): Promise<void> {
  const r = await own(actor, id);
  if (!UUID.test(linkId)) throw new AccessDenied();
  await revokeShareLink(actor, ref(r), linkId);
}

/** What a view link shows, or null if the link is unknown, off or for something else. */
export async function setupByLink(token: string): Promise<Setup | null> {
  const link = await resolveShareLink(token);
  if (!link || link.app !== APP || link.type !== "setup") return null;
  const r = await row(link.id);
  return r ? toSetup(r) : null;
}
