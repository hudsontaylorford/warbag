import { test, expect } from "@playwright/test";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("sample family: browse years, view as made-up people, then delete it", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/gyfte");
  await page.getByRole("button", { name: "Try a sample family" }).click();

  await expect(page.getByRole("heading", { name: "Sample family" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Christmas \d{4}$/ })).toBeVisible();
  const rows = page.getByRole("listitem");
  await expect(rows.filter({ hasText: "Sample Kid" })).toContainText(/\d+ gifts ›/);
  await expect(rows.filter({ hasText: "(you)" })).toContainText("Start my list");

  // Last year.
  const years = page.getByRole("navigation", { name: "Years" }).getByRole("link");
  await years.first().click();
  await expect(page.getByRole("heading", { name: /^Christmas \d{4}$/ })).toBeVisible();

  // View as Sample Aunt: her own list has no claim info; Mom's list shows claims.
  await page.getByLabel("View as").selectOption({ label: "Sample Aunt" });
  await expect(page.getByText("Viewing as Sample Aunt. Read-only.")).toBeVisible();
  await page.getByRole("navigation", { name: "Years" }).getByRole("link").last().click().catch(() => {});
  await page.getByRole("listitem").filter({ hasText: "Sample Aunt" }).getByRole("link").click();
  await expect(page.getByText("Viewing as Sample Aunt. Read-only.")).toBeVisible();
  await expect(page.getByText(/Claimed|getting this|Not claimed/)).toHaveCount(0);
  await expect(page.getByLabel("Add a gift")).toHaveCount(0);

  await page.getByRole("link", { name: "‹ Group" }).click();
  await page.getByRole("listitem").filter({ hasText: "Sample Mom" }).getByRole("link").click();
  await expect(page.getByText("You're getting this ✓")).toBeVisible(); // Aunt claimed the apron
  await expect(page.getByText("Claimed").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "I'll get this" })).toHaveCount(0);

  // Stop viewing as, back on the group, delete the sample family.
  await page.getByRole("link", { name: "Stop" }).click();
  await expect(page.getByText("Viewing as")).toHaveCount(0);
  await page.getByRole("link", { name: "‹ Group" }).click();
  await page.getByRole("button", { name: "Delete sample family" }).click();
  await page.getByRole("button", { name: "Yes, delete sample family" }).click();
  await expect(page).toHaveURL(/\/gyfte$/);
  await expect(page.getByRole("link", { name: /Sample family/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try a sample family" })).toBeVisible();
});
