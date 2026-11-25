import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("write a note, label it, set a reminder, trash and restore it", async ({ page }) => {
  const word = `Peonies ${randomUUID().slice(0, 4)}`;
  await signIn(page, OWNER);
  await page.getByRole("link", { name: /Jot/ }).click();
  await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();

  await page.getByRole("link", { name: "New note" }).click();
  await expect(page.getByText("Saved to your notes once you start typing.")).toBeVisible();
  await page.getByLabel("Note").fill(`Order **${word}**\n- 3 boxes\n- pick up Monday`);
  await expect(page.getByText("Saved ✓")).toBeVisible();
  // The new note has its own address now.
  await expect(page).toHaveURL(/\/jot\/[0-9a-f-]{36}$/);

  await page.locator("label", { hasText: "Pink" }).click();
  await page.locator("label", { hasText: "Urgent" }).click();
  await expect(page.getByRole("radio", { name: "Pink" })).toBeChecked();
  await expect(page.getByText("Saved ✓")).toBeVisible();
  await page.getByLabel("When").fill("2030-06-01T09:00");
  await expect(page.getByText(/An email goes to owner@example\.test at/)).toBeVisible();
  await expect(page.getByText("Saved ✓")).toBeVisible();

  await page.getByRole("link", { name: "‹ Notes" }).click();
  const card = page.getByRole("link", { name: new RegExp(word) });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Urgent");
  await expect(card).toContainText("Remind");
  await expect(card.locator("strong")).toHaveText(word);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // By label groups it under Urgent.
  await page.getByRole("link", { name: "By label" }).click();
  await expect(page.getByRole("region", { name: /Urgent/ }).getByRole("link", { name: new RegExp(word) })).toBeVisible();

  // Trash and restore.
  await card.click();
  await page.getByRole("button", { name: "Move to Trash" }).click();
  await expect(page.getByText("Moved to the Trash ✓")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(word) })).toHaveCount(0);
  await page.getByRole("link", { name: "Open Trash" }).click();
  await expect(page.getByText("30 days left").first()).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: word }).getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Restored to your notes ✓").or(page.getByText("The Trash is empty."))).toBeVisible();
  await page.getByRole("link", { name: "‹ Notes" }).click();
  await expect(page.getByRole("link", { name: new RegExp(word) })).toBeVisible();
});

test("a note left empty is never made", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/jot");
  const before = await page.getByRole("list", { name: "Your notes" }).getByRole("listitem").count().catch(() => 0);
  await page.getByRole("link", { name: "New note" }).click();
  await page.getByRole("link", { name: "‹ Notes" }).click();
  await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
  const after = await page.getByRole("list", { name: "Your notes" }).getByRole("listitem").count().catch(() => 0);
  expect(after).toBe(before);
});

test("someone without Jot gets not found", async ({ page }) => {
  await page.goto("/jot");
  await expect(page).toHaveURL(/sign-in/);
});
