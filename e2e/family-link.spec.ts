import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { OWNER } from "../playwright.config";
import { signIn, sentTo } from "./helpers";

test("family link: open without signing in, This is me, tap the emailed link, you're in", async ({ page, browser }) => {
  const tag = randomUUID().slice(0, 6);
  const molly = `molly-${tag}@example.test`;

  // The owner makes a group and its family link.
  await signIn(page, OWNER);
  await page.goto("/gyfte");
  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill(`Fam ${tag}`);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: `Fam ${tag}` })).toBeVisible();

  // A family member in the group (added the usual way would be People > group).
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  const id = randomUUID();
  await db.query(`insert into "user" ("id", "name", "email", "emailVerified", "updatedAt") values ($1, 'Molly', $2, true, now())`, [id, molly]);
  await db.query(
    `insert into group_members (group_id, user_id) select access_group_id, $1 from gyfte_groups where name = $2`,
    [id, `Fam ${tag}`],
  );
  await db.end();

  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "Make a family link" }).click();
  const link = await page.getByLabel("Family link").inputValue();
  expect(link).toMatch(/\/j\/[A-Za-z0-9_-]{32}$/);

  // Someone opens it from the group chat: no sign-in, names visible.
  const phone = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await phone.goto(link);
  await expect(phone.getByRole("heading", { name: `Fam ${tag}` })).toBeVisible();
  const row = phone.getByRole("listitem").filter({ hasText: "Molly" });
  await expect(row).toContainText("No list yet");
  await row.getByRole("button", { name: "This is me" }).click();
  await expect(phone.getByText("We emailed Molly a sign-in link.")).toBeVisible();

  // She taps the link in her email on the same phone.
  let url = "";
  await expect.poll(() => (url = sentTo(molly).at(-1)?.text.match(/https?:\/\/\S+/)?.[0] ?? "")).not.toBe("");
  await phone.goto(url);
  await expect(phone).toHaveURL(/\/gyfte\/groups\//);
  await expect(phone.getByRole("listitem").filter({ hasText: "(you)" })).toContainText("Molly");
  await expect(phone.getByRole("button", { name: "Start my list" })).toBeVisible();

  // The link works once.
  const again = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await again.goto(url);
  await expect(again).not.toHaveURL(/\/gyfte\/groups\//);

  // Turned off, the family link stops working.
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByRole("button", { name: "Make a family link" })).toBeVisible();
  const res = await again.goto(link);
  expect(res?.status()).toBe(404);
});
