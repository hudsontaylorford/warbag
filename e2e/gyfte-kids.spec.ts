import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("add a kid in a group, start their list, it shows under you", async ({ page }) => {
  const tag = randomUUID().slice(0, 4);
  await signIn(page, OWNER);
  await page.goto("/gyfte");
  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill(`Kids ${tag}`);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: `Kids ${tag}` })).toBeVisible();

  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "Add a kid" }).click();
  await page.getByLabel("Kid's name").fill(`Kiddo ${tag}`);
  await page.getByRole("button", { name: "Add kid" }).click();

  const kidRow = page.getByRole("listitem").filter({ hasText: `Kiddo ${tag}` }).first();
  await expect(kidRow).toContainText("↳");
  await kidRow.getByRole("button", { name: "Start list" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`^Kiddo ${tag} · Christmas \\d{4}$`) })).toBeVisible();
  await page.getByLabel("Add a gift").fill("Wooden train");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Wooden train")).toBeVisible();

  await page.getByRole("link", { name: "‹ Family" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: `Kiddo ${tag}` }).first()).toContainText("1 gift ›");
});
