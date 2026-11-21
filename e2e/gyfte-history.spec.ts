import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("a past list is read-only, Edit history allows changes, Copy to this year carries gifts forward", async ({ page }) => {
  const kid = `Kid ${randomUUID().slice(0, 4)}`;
  await signIn(page, OWNER);
  await page.goto("/gyfte/new");
  await page.getByRole("radio", { name: /Someone without an account/ }).check();
  await page.getByLabel("Their name").fill(kid);
  await page.getByRole("radio", { name: "Birthday" }).check();
  await page.locator("input[type=date]").fill("2024-03-14");
  await page.getByRole("button", { name: "Create list" }).click();

  await expect(page.getByRole("heading", { name: `${kid} · Birthday 2024` })).toBeVisible();
  await expect(page.getByText("This list is in History, so it's read-only.")).toBeVisible();
  await expect(page.getByLabel("Add a gift")).toHaveCount(0);

  await page.getByRole("link", { name: "Edit history" }).click();
  await expect(page.getByText("Editing history.")).toBeVisible();
  await page.getByLabel("Add a gift").fill("Wooden blocks");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Wooden blocks")).toBeVisible();
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page.getByLabel("Add a gift")).toHaveCount(0);

  await page.getByRole("button", { name: /^Copy to \d{4}$/ }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`^${kid} · Birthday \\d{4}$`) })).not.toHaveText(`${kid} · Birthday 2024`);
  await expect(page.getByText("Wooden blocks")).toBeVisible();
  await expect(page.getByLabel("Add a gift")).toBeVisible();
  await expect(page.getByRole("link", { name: "‹ 2024" })).toBeVisible();
});
