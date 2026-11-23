import { test, expect, type Browser } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

async function freshPage(browser: Browser) {
  return (await browser.newContext({ ...test.info().project.use })).newPage();
}

test("a co-organizer runs the trip but can't share or delete it", async ({ page, browser }) => {
  const tag = randomUUID().slice(0, 4);
  const email = `coorg-${randomUUID().slice(0, 8)}@example.test`;
  await signIn(page, OWNER);
  await page.goto("/mosey/new");
  await page.getByLabel("Trip name").fill(`Roles ${tag}`);
  await page.getByLabel("First day").fill("2027-09-01");
  await page.getByLabel("Last day").fill("2027-09-02");
  await page.getByRole("button", { name: "Create trip" }).click();
  await page.waitForURL(/mosey\/[0-9a-f-]{36}$/);
  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByLabel("Their name").fill("Co Organizer");
  await page.getByLabel("Their email").fill(email);
  await page.getByRole("combobox", { name: /^Add as/ }).selectOption({ label: "Co-organizer" });
  await page.getByLabel("Email them how to sign in").uncheck();
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByText(`Added ${email} ✓`)).toBeVisible();

  const co = await freshPage(browser);
  await signIn(co, email);
  await co.goto("/mosey");
  await co.getByRole("link", { name: new RegExp(`Roles ${tag}`) }).click();
  // Plans like the owner: adds straight to a day.
  const day = co.getByRole("region", { name: /Wed, Sep 1/ });
  await day.getByRole("button", { name: "+ Add to this day" }).click();
  await day.getByLabel(/^Add to/).fill("Ferry");
  await day.getByRole("button", { name: "Add", exact: true }).click();
  await expect(day.getByText("Ferry")).toBeVisible();
  // Manage has trip details only: no sharing, no trip link, no delete.
  await co.locator("summary", { hasText: "Manage" }).click();
  await expect(co.getByLabel("Trip name")).toBeVisible();
  for (const name of ["Invite", "Make a trip link", "Delete"]) await expect(co.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(co.getByRole("heading", { name: "Co-organizers" })).toHaveCount(0);
});

test("a people manager invites and edits others, never their own access or an admin's", async ({ page, browser }) => {
  const email = `pm-${randomUUID().slice(0, 8)}@example.test`;
  const other = `other-${randomUUID().slice(0, 8)}@example.test`;
  await signIn(page, OWNER);
  await page.goto("/admin");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Name", { exact: true }).fill("Helper PM");
  await page.getByLabel("Email them how to sign in").uncheck();
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`Added ${email}`)).toBeVisible();
  await page.getByRole("link", { name: /Helper PM/ }).click();
  await page.getByRole("checkbox", { name: "People manager" }).check();
  await expect(page.getByText("Saved ✓").first()).toBeVisible();

  const pm = await freshPage(browser);
  await signIn(pm, email);
  await expect(pm.getByRole("link", { name: "People" })).toBeVisible();
  await pm.goto("/admin");
  await pm.getByLabel("Email", { exact: true }).fill(other);
  await pm.getByLabel("Name", { exact: true }).fill("Other Person");
  await pm.getByLabel("Email them how to sign in").uncheck();
  await pm.getByRole("button", { name: "Invite" }).click();
  await expect(pm.getByText(`Added ${other}`)).toBeVisible();
  // Someone else: apps and groups can be changed; no Remove.
  await pm.getByRole("link", { name: /Other Person/ }).click();
  await pm.locator("form", { has: pm.getByRole("group", { name: "Apps" }) }).getByRole("checkbox", { name: /Mosey/ }).check();
  await expect(pm.getByText("Saved ✓").first()).toBeVisible();
  await expect(pm.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(pm.getByRole("heading", { name: "People manager" })).toHaveCount(0);
  // Their own page and an admin's: no apps or groups to change.
  await pm.goto("/admin");
  await pm.getByRole("link", { name: /Helper PM/ }).click();
  await expect(pm.getByText("Your own apps and groups are set by an admin.")).toBeVisible();
  await pm.goto("/admin");
  await pm.locator("a", { hasText: OWNER }).first().click();
  await expect(pm.getByText("Only admins can change an admin's apps and groups.")).toBeVisible();
});
