import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("share a list with a group; a shopper claims; the recipient never sees it", async ({ page, browser }) => {
  // A fictional family member in a group with the owner, with Gyfte.
  const tag = randomUUID().slice(0, 6);
  const shopper = `shopper-${tag}@example.test`;
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  const shopperId = randomUUID();
  await db.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "updatedAt") values ($1, 'Shopper', $2, true, now())`,
    [shopperId, shopper],
  );
  const owner = await db.query(`select id from "user" where email = $1`, [OWNER]);
  const group = await db.query(`insert into groups (name) values ($1) returning id`, [`Fam ${tag}`]);
  await db.query(`insert into group_members (group_id, user_id) values ($1, $2), ($1, $3)`, [
    group.rows[0].id,
    owner.rows[0].id,
    shopperId,
  ]);
  await db.query(`insert into app_grants (app, user_id) values ('gyfte', $1)`, [shopperId]);
  await db.end();

  // The owner makes a list and shares it with the group.
  await signIn(page, OWNER);
  await page.goto("/gyfte/new");
  await page.getByLabel("Your name").fill(`Owner ${tag}`);
  await page.getByRole("button", { name: "Create list" }).click();
  await page.getByLabel("Add a gift").fill("Leather tote");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Leather tote")).toBeVisible();
  await expect(page.getByText("Only you can see this list.")).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("checkbox", { name: `Fam ${tag}` }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`Shared with Fam ${tag}`)).toBeVisible();
  await page.getByRole("button", { name: "Make a link" }).click();
  const link = await page.getByLabel("Share link").inputValue();
  const listUrl = page.url();

  // The shopper sees it shared with them and claims the tote.
  const theirs = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await signIn(theirs, shopper);
  await theirs.goto("/gyfte");
  await theirs.getByRole("link", { name: new RegExp(`Owner ${tag}`) }).click();
  await expect(theirs.getByLabel("Add a gift")).toHaveCount(0);
  await theirs.getByRole("button", { name: "I'll get this" }).click();
  await expect(theirs.getByText("You're getting this ✓")).toBeVisible();
  await theirs.goto("/gyfte/claims");
  await expect(theirs.getByRole("link", { name: "Leather tote" }).or(theirs.getByText("Leather tote"))).toBeVisible();

  // The owner, who the list is for, sees no trace of it.
  await page.goto(listUrl);
  await expect(page.getByText("Leather tote")).toBeVisible();
  const gifts = page.getByRole("list");
  await expect(gifts.getByText(/claimed|getting this/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "I'll get this" })).toHaveCount(0);

  // Nor does anyone opening the share link.
  const anon = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await anon.goto(link);
  await expect(anon.getByText("Leather tote")).toBeVisible();
  await expect(anon.getByText(/claimed|getting this/i)).toHaveCount(0);

  // Undo from My claims.
  await theirs.getByRole("button", { name: "Undo" }).click();
  await expect(theirs.getByText("Nothing yet.")).toBeVisible();
});
