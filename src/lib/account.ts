import "server-only";
import { pool } from "./db";
import { InputError } from "./errors";
import type { Actor } from "./access";

/** Your display name: what people see instead of your email. 1 to 80 characters. */
export async function setMyName(actor: Actor, raw: string): Promise<string> {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) throw new InputError("Add your name.");
  if (name.length > 80) throw new InputError("Names are at most 80 characters.");
  await pool.query(`update "user" set name = $2, "updatedAt" = now() where id = $1`, [actor.id, name]);
  return name;
}
