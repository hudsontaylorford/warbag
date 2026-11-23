import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";
import { exportFile, recording, wav } from "../tests/support/roomtune";

async function member(apps: string[]) {
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  const id = randomUUID();
  const email = `member-${id.slice(0, 8)}@example.test`;
  await db.query(`insert into "user" ("id", "name", "email", "emailVerified", "updatedAt") values ($1, '', $2, true, now())`, [id, email]);
  for (const app of apps) await db.query(`insert into app_grants (app, user_id) values ($1, $2)`, [app, id]);
  await db.end();
  return email;
}

async function newSetup(page: Page, name: string) {
  await page.goto("/roomtune");
  await page.getByRole("link", { name: "New setup" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Start from").selectOption("b5");
  await page.getByRole("button", { name: "Create setup" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("measure a round, enter the fix, and it's saved", async ({ page }) => {
  const name = `Test speaker ${randomUUID().slice(0, 4)}`;
  await signIn(page, OWNER);
  await page.getByRole("link", { name: /Room Tuner/ }).click();
  await expect(page.getByRole("heading", { name: "Setups" })).toBeVisible();
  await newSetup(page, name);
  await expect(page.getByText("Example only.")).toBeVisible();

  await page.getByLabel("Speaker volume in its app").fill("30%");
  await page.getByLabel("Meter reading at your seat (dB)").fill("75");
  await page.getByTestId("round-files").setInputFiles({ name: "spot1.wav", mimeType: "audio/wav", buffer: wav(recording({ seconds: 20 })) });
  await expect(page.getByText("Round 1: 1 recording analyzed.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Saved to your account ✓")).toBeVisible();
  await expect(page.getByText("Example only.")).toHaveCount(0);
  // 20 seconds is usable but short: the page says so.
  await expect(page.getByText(/spot1\.wav is short/)).toBeVisible();

  const suggested = await page.getByRole("list", { name: "Suggested slider values" }).locator("li > span:first-child").allTextContents();
  expect(suggested).toHaveLength(5);
  await page.getByRole("button", { name: "I've entered these in the app" }).click();
  await expect(page.getByText("Saved to your account ✓")).toBeVisible();
  const during = await page.getByRole("group", { name: "EQ on the speaker during this round (dB)" }).locator("input").evaluateAll((els) => els.map((e) => Number((e as HTMLInputElement).value)));
  expect(during.map((v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0"))).toEqual(suggested);
  await expect(page.getByRole("button", { name: "Upload Round 2" })).toBeVisible();

  // No sideways scroll at phone width.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Everything is still there after a reload.
  await page.reload();
  await expect(page.getByText(/1 round, latest/)).toBeVisible();
  await expect(page.getByText(`Round 1 fit`, { exact: true })).toBeVisible();
  await expect(page.getByText("On the speaker ·", { exact: false })).toBeVisible();
});

test("import an export file", async ({ page }) => {
  const name = `Imported ${randomUUID().slice(0, 4)}`;
  await signIn(page, OWNER);
  await page.goto("/roomtune");
  await page.locator("summary", { hasText: "Import setups" }).click();
  await page.getByLabel("Export file (.json)").setInputFiles({ name: "room-tuner-setups.json", mimeType: "application/json", buffer: Buffer.from(exportFile(name)) });
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 1 setup ✓")).toBeVisible();
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Evening", { exact: true })).toBeVisible();
  await expect(page.getByText("Example only.")).toHaveCount(0);
});

test("a view link shows the setup without signing in, until it's turned off", async ({ page, browser }) => {
  const name = `Shared ${randomUUID().slice(0, 4)}`;
  await signIn(page, OWNER);
  await newSetup(page, name);
  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "Make a view link" }).click();
  const url = await page.getByLabel("View link").inputValue();
  expect(url).toMatch(/\/rt\/[A-Za-z0-9_-]{32}$/);

  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto(url);
  await expect(v.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(v.getByRole("button", { name: /Upload|Save|Delete/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByRole("button", { name: "Make a view link" })).toBeVisible();
  const res = await v.goto(url);
  expect(res?.status()).toBe(404);
  await visitor.close();
});

test("without app access Room Tuner isn't there, and nobody opens someone else's setup", async ({ page, browser }) => {
  await signIn(page, OWNER);
  await newSetup(page, "Owner's den");
  const ownerSetup = page.url();

  const outsider = await browser.newContext();
  const o = await outsider.newPage();
  await signIn(o, await member([]));
  await expect(o.getByText("Room Tuner")).toHaveCount(0);
  expect((await o.goto("/roomtune"))?.status()).toBe(404);
  await outsider.close();

  const friendCtx = await browser.newContext();
  const f = await friendCtx.newPage();
  await signIn(f, await member(["roomtune"]));
  await expect(f.getByRole("link", { name: /Room Tuner/ })).toBeVisible();
  expect((await f.goto(ownerSetup))?.status()).toBe(404);
  await f.goto("/roomtune");
  await expect(f.getByText("No setups yet.")).toBeVisible();
  await friendCtx.close();
});
