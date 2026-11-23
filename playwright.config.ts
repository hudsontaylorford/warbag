import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// End-to-end tests run the real app against a throwaway database.
// Requires TEST_DATABASE_URL (a database these tests may wipe).
const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error("Set TEST_DATABASE_URL to a database the tests may wipe.");

export const OUTBOX = path.join(__dirname, "test-results", "outbox.jsonl");
export const OWNER = "owner@example.test";
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: testDb,
      BETTER_AUTH_SECRET: "test-secret-not-for-production-0123456789",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      EMAIL_OUTBOX_FILE: OUTBOX,
      RECEIPT_STORE_DIR: path.join(path.dirname(OUTBOX), "receipts"),
      ANTHROPIC_API_KEY: "",
      AUTH_RATE_LIMIT: "off",
    },
  },
});
