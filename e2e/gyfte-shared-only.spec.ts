import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("a family member without Gyfte opens a list shared with them, but can't make lists", async ({ page, browser }) => {
  const tag = randomUUID().slice(0, 6);
  const member = `relative-${tag}@example.test`;
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  const memberId = randomUUID();
  await db.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "updatedAt") values ($1, 'Relative', $2, true, now())`,
    [memberId, member],
  );
  const owner = await db.query(`select id from "user" where email = $1`, [OWNER]);
  const group = await db.query(`insert into groups (name) values ($1) returning id`, [`Kin ${tag}`]);
  await db.query(`insert into group_members (group_id, user_id) values ($1, $2), ($1, $3)`, [
    group.rows[0].id,
    owner.rows[0].id,
    memberId,
  ]);
  await db.end();

  await signIn(page, OWNER);
  await page.goto("/gyfte/new");
  await page.getByLabel("Your name").fill(`Shared ${tag}`);
  await page.getByRole("button", { name: "Create list" }).click();
  await page.getByLabel("Add a gift").fill("Wool scarf");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Wool scarf")).toBeVisible();
  if (await page.getByRole("button", { name: "Change" }).count()) await page.getByRole("button", { name: "Change" }).click();
  else await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("checkbox", { name: `Kin ${tag}` }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(new RegExp(`Shared with .*Kin ${tag}`))).toBeVisible();

  const theirs = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await signIn(theirs, member);
  await theirs.getByRole("link", { name: /Gyfte/ }).click();
  await expect(theirs.getByRole("link", { name: "New list" })).toHaveCount(0);
  await theirs.getByRole("link", { name: new RegExp(`Shared ${tag}`) }).click();
  await expect(theirs.getByText("Wool scarf")).toBeVisible();
  await expect(theirs.getByRole("button", { name: "I'll get this" })).toBeVisible();
  const res = await theirs.goto("/gyfte/new");
  expect(res?.status()).toBe(404);
});
