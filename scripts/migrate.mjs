// Applies db/migrations/*.sql in order, once each, then makes sure the owner
// account exists. Runs before every build (see package.json) and is safe to
// re-run. Without DATABASE_URL it does nothing, so builds without a database
// (CI, a fresh clone) still work.
//
// Rules for migration files: never edit one that has shipped; add a new,
// higher-numbered file instead. Each file runs inside a transaction.

import { readdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("migrate: no DATABASE_URL, skipping");
  process.exit(0);
}
// On Vercel, only production deploys migrate. Preview builds may share the
// production database, and an unmerged PR must never change it.
if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.log(`migrate: Vercel ${process.env.VERCEL_ENV} build, skipping`);
  process.exit(0);
}

const dir = path.join(import.meta.dirname, "..", "db", "migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query(`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  // One build at a time: concurrent deploys wait here instead of racing.
  await client.query("select pg_advisory_lock(727274)");

  const done = new Set(
    (await client.query("select name from schema_migrations")).rows.map((r) => r.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`migrate: applied ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`migrate: ${file} failed: ${err.message}`);
    }
  }

  // The owner (OWNER_EMAIL) is the first admin. Everyone else is invited.
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (owner) {
    const res = await client.query(
      `insert into "user" ("id", "name", "email", "emailVerified", "isAdmin", "updatedAt")
       values ($1, '', $2, true, true, now())
       on conflict ("email") do update set "isAdmin" = true
       returning (xmax = 0) as created`,
      [randomUUID(), owner],
    );
    console.log(res.rows[0].created ? "migrate: owner account created" : "migrate: owner account ok");
  }
} finally {
  await client.end();
}
