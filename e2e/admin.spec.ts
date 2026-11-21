import { test, expect, type Browser } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { sentTo, signIn } from "./helpers";

async function freshPage(browser: Browser) {
  const context = await browser.newContext({ ...test.info().project.use });
  return context.newPage();
}

test("the owner invites someone, gives them Gyfte through a group, then takes it away", async ({ page, browser }) => {
  const email = `invitee-${randomUUID().slice(0, 8)}@example.test`;
  const group = `Family ${randomUUID().slice(0, 4)}`;

  // Invite.
  await signIn(page, OWNER);
  await page.getByRole("link", { name: "People" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Name").fill("Test Person");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`Invited ${email}`)).toBeVisible();
  await expect.poll(() => sentTo(email).map((m) => m.subject)).toContainEqual(expect.stringContaining("invited you to warbag"));
  await expect(page.getByRole("link", { name: /Test Person/ })).toBeVisible();

  // A group with Gyfte, and the new person in it.
  await page.getByLabel("New group").fill(group);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: group })).toBeVisible();
  await page.getByRole("checkbox", { name: /Test Person/ }).check();
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Saved ✓").first()).toBeVisible();
  const apps = page.locator("form", { has: page.getByRole("group", { name: "Apps" }) });
  await apps.getByRole("checkbox", { name: /Gyfte/ }).check();
  await apps.getByRole("button", { name: "Save" }).click();
  await expect(apps.getByText("Saved ✓")).toBeVisible();

  // They sign in and see Gyfte, nothing else, and no People page.
  const theirs = await freshPage(browser);
  await signIn(theirs, email);
  await expect(theirs.getByRole("list").getByText("Gyfte")).toBeVisible();
  await expect(theirs.getByText("Chirk")).toHaveCount(0);
  await expect(theirs.getByRole("link", { name: "People" })).toHaveCount(0);
  const res = await theirs.goto("/admin");
  expect(res?.status()).toBe(404);

  // Taking the app away from the group applies on their next page load.
  await apps.getByRole("checkbox", { name: /Gyfte/ }).uncheck();
  await apps.getByRole("button", { name: "Save" }).click();
  await expect(apps.getByText("Saved ✓")).toBeVisible();
  await theirs.goto("/home");
  await expect(theirs.getByText("Nothing here yet.")).toBeVisible();

  // Removing them signs them out.
  await page.goto("/admin");
  await page.getByRole("link", { name: /Test Person/ }).click();
  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Yes, remove" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: /Test Person/ })).toHaveCount(0);
  await theirs.goto("/home");
  await expect(theirs).toHaveURL(/\/sign-in/);
});

test("people who aren't admins get not found on admin pages", async ({ page }) => {
  const res = await page.goto("/admin");
  // Signed out: sent to sign in.
  expect(page.url()).toContain("/sign-in");
  expect(res?.ok()).toBe(true);
});
