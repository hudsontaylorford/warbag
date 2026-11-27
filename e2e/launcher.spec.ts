import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("the owner sees every app, with external ones opening in a new tab", async ({ page }) => {
  await signIn(page, OWNER);
  // warbag's own apps under Apps, external products under Other sites.
  await expect(page.getByRole("region", { name: "Apps" }).getByRole("link", { name: "Gyfte" })).toBeVisible();
  const other = page.getByRole("region", { name: "Other sites" });

  const chirk = other.getByRole("link", { name: /Chirk/ });
  await expect(chirk).toHaveAttribute("href", "https://chirk.fyi");
  await expect(chirk).toHaveAttribute("target", "_blank");
  await expect(other.getByRole("link", { name: /Crewmaxxing/ })).toHaveAttribute(
    "href",
    "https://app.crewmaxxing.com",
  );
});

test("a member sees only the apps shared with them", async ({ page }) => {
  // A fictional invited member with access to Gyfte only.
  const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  const id = randomUUID();
  const email = `member-${id.slice(0, 8)}@example.test`;
  await db.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "updatedAt") values ($1, '', $2, true, now())`,
    [id, email],
  );
  await db.query(`insert into app_grants (app, user_id) values ('gyfte', $1)`, [id]);
  await db.end();

  // With just one app, "home" is that app: no launcher, no other sites, no warbag link.
  await signIn(page, email);
  await expect(page).toHaveURL(/\/gyfte$/);
  await expect(page.getByText("Chirk")).toHaveCount(0);
  await expect(page.getByText("Crewmaxxing")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "warbag", exact: true })).toHaveCount(0);
});
