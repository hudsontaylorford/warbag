import { test, expect, type Browser } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

async function freshPage(browser: Browser) {
  return (await browser.newContext({ ...test.info().project.use })).newPage();
}

test("Mosey: join from the trip link without an account, come back with your own link", async ({ page, browser }) => {
  const tag = randomUUID().slice(0, 4);
  await signIn(page, OWNER);
  await page.goto("/mosey/new");
  await page.getByLabel("Trip name").fill(`Shore ${tag}`);
  await page.getByLabel("First day").fill("2027-08-01");
  await page.getByLabel("Last day").fill("2027-08-03");
  await page.getByRole("button", { name: "Create trip" }).click();
  await page.waitForURL(/mosey\/[0-9a-f-]{36}$/);
  const tripUrl = page.url();
  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "Make a trip link" }).click();
  const link = await page.getByLabel("Trip link").inputValue();

  // Off by default: the link asks to join.
  const cousin = await freshPage(browser);
  await cousin.goto(link);
  await expect(cousin.getByRole("button", { name: "Ask to join" })).toBeVisible();

  // The owner lets people join and edit (it saves itself).
  await page.getByText("Join and edit, no sign-in").click();
  await expect(page.getByText("Saved ✓")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Joined by link" })).toBeVisible();

  // Someone with the link types their name and is on the trip, signed out.
  await cousin.reload();
  await cousin.getByLabel("Your name").fill("Cousin Kay");
  await cousin.getByRole("button", { name: "Join", exact: true }).click();
  await cousin.waitForURL(/mosey\/[0-9a-f-]{36}$/);
  await expect(cousin.getByRole("heading", { name: `Shore ${tag}` })).toBeVisible();
  // Money is off the link by default.
  await expect(cousin.getByRole("navigation", { name: "Trip" }).getByRole("link", { name: "Money" })).toHaveCount(0);
  await cousin.getByText("Your link").click();
  const own = await cousin.getByLabel("Your link").inputValue();
  expect(own).toMatch(/\/m\/me\/[A-Za-z0-9_-]{32}$/);
  await cousin.goto(tripUrl.replace(/.*\/mosey\//, "/mosey/") + "/money");
  await cousin.waitForURL(/mosey\/[0-9a-f-]{36}$/);

  // Their own link on another device: one tap and they're back.
  const phone = await freshPage(browser);
  await phone.goto(own);
  await expect(phone.getByText("Cousin Kay's own link")).toBeVisible();
  await phone.getByRole("button", { name: "Open the trip as Cousin Kay" }).click();
  await phone.waitForURL(/mosey\/[0-9a-f-]{36}$/);
  await expect(phone.getByRole("heading", { name: `Shore ${tag}` })).toBeVisible();

  // With Money on the link, they see it.
  await page.reload();
  await page.locator("summary", { hasText: "Manage" }).click();
  await expect(page.locator("li", { hasText: "Cousin Kay" })).toBeVisible();
  await page.getByText("Include Money for people who joined by link").click();
  await expect(page.getByText("Saved ✓")).toBeVisible();
  await phone.reload();
  await phone.getByRole("navigation", { name: "Trip" }).getByRole("link", { name: "Money" }).click();
  await expect(phone.getByText("Cousin Kay")).toBeVisible();

  // The owner turns them off: signed out everywhere, own link dead.
  await page.locator("li", { hasText: "Cousin Kay" }).getByRole("button", { name: "Turn off" }).click();
  await page.getByRole("button", { name: "Yes, turn off" }).click();
  await expect(page.locator("li", { hasText: "Cousin Kay" })).toHaveCount(0);
  await phone.goto(own);
  await expect(phone.getByRole("heading", { name: "This link isn't working" })).toBeVisible();
});
