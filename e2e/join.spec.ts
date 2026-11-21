import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn, sentTo } from "./helpers";

test("ask to join from a family link; the admin adds them; they sign in with This is me", async ({ page, browser }) => {
  const tag = randomUUID().slice(0, 6);
  const avery = `avery-${tag}@example.test`;

  await signIn(page, OWNER);
  await page.goto("/gyfte");
  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill(`Join ${tag}`);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: `Join ${tag}` })).toBeVisible();
  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "Make a family link" }).click();
  const link = await page.getByLabel("Family link").inputValue();

  // Someone not on the link asks to join.
  const phone = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await phone.goto(link);
  await phone.getByRole("button", { name: "Ask to join" }).click();
  await phone.getByLabel("Your name").fill("Avery");
  await phone.getByLabel("Your email").fill(avery);
  await phone.getByRole("button", { name: "Send request" }).click();
  await expect(phone.getByRole("heading", { name: "Welcome to Gyfte" })).toBeVisible();
  expect(sentTo(avery)).toEqual([]); // nothing is emailed for a request

  // The admin sees it under Manage and adds them.
  await page.reload();
  await expect(page.locator("summary", { hasText: "Manage" })).toContainText("1 request");
  await page.locator("summary", { hasText: "Manage" }).click();
  const row = page.getByRole("listitem").filter({ hasText: avery });
  await row.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Avery is in.")).toBeVisible();

  // Back on the link, Avery is listed and can sign in with This is me.
  await phone.reload();
  const me = phone.getByRole("listitem").filter({ hasText: "Avery" });
  await me.getByRole("button", { name: "This is me" }).click();
  await expect(phone.getByText("We emailed Avery a sign-in link.")).toBeVisible();
  await expect.poll(() => sentTo(avery).length).toBe(1);
});
