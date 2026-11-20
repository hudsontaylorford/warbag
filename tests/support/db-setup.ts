import { execFileSync } from "node:child_process";
import pg from "pg";

// Database tests run against TEST_DATABASE_URL, which they wipe first.
// Without it they're skipped (see `describeDb`), unless REQUIRE_DB_TESTS=1.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    if (process.env.REQUIRE_DB_TESTS === "1") throw new Error("REQUIRE_DB_TESTS=1 but TEST_DATABASE_URL is not set");
    return;
  }
  process.env.DATABASE_URL = url;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("drop schema public cascade; create schema public;");
  await client.end();
  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: url, OWNER_EMAIL: "" },
    stdio: "inherit",
  });
}
