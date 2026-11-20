import { randomUUID } from "node:crypto";
import { describe } from "vitest";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
// The app's pool reads DATABASE_URL when first imported.
if (url) process.env.DATABASE_URL = url;

/** `describe` that runs only when a test database is configured. */
export const describeDb = url ? describe : describe.skip;

export const admin = new pg.Pool({ connectionString: url });

/** A fictional user. Returns the shape the access rules use. */
export async function makeUser(opts: { isAdmin?: boolean } = {}) {
  const id = randomUUID();
  await admin.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "isAdmin", "updatedAt")
     values ($1, '', $2, true, $3, now())`,
    [id, `${id}@example.test`, opts.isAdmin === true],
  );
  return { id, isAdmin: opts.isAdmin === true };
}
