import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { OUTBOX, OWNER } from "../playwright.config";

// Fresh database and empty outbox for every run.
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL!;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("drop schema public cascade; create schema public;");
  await client.end();

  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: url, OWNER_EMAIL: OWNER },
    stdio: "inherit",
  });

  mkdirSync(path.dirname(OUTBOX), { recursive: true });
  rmSync(OUTBOX, { force: true });
}
