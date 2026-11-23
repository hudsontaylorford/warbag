import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("Mosey editing: one editor at a time, named, and a note always lands on the right entry", async ({ page }) => {
  const tag = randomUUID().slice(0, 4);
  await signIn(page, OWNER);
  await page.goto("/mosey/new");
  await page.getByLabel("Trip name").fill(`Edit ${tag}`);
  await page.getByLabel("First day").fill("2027-08-01");
  await page.getByLabel("Last day").fill("2027-08-01");
  await page.getByRole("button", { name: "Create trip" }).click();
  const day = page.getByRole("region", { name: /Sun, Aug 1/ });
  await day.getByRole("button", { name: "+ Add to this day" }).click();
  for (const t of ["Van pickup", "Lunch stop"]) {
    await day.getByLabel(/^Add to/).fill(t);
    await day.getByRole("button", { name: "Add", exact: true }).click();
    await expect(day.getByText(t)).toBeVisible();
  }
  await day.getByRole("button", { name: "Done adding" }).click();

  // Open one entry's editor, then another's: only the second stays open.
  await day.getByRole("listitem").filter({ hasText: "Van pickup" }).getByRole("button", { name: "More" }).click();
  await day.getByRole("listitem").filter({ hasText: "Lunch stop" }).getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("form", { name: /^Editing/ })).toHaveCount(1);
  await expect(page.getByRole("form", { name: "Editing: Lunch stop" })).toBeVisible();

  // Filling "Notes" by its label can only reach the open editor.
  await expect(page.getByLabel("Notes", { exact: true })).toHaveCount(1);
  await page.getByLabel("Notes", { exact: true }).fill("Order ahead");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  // Save closes the editor and confirms on the entry that changed.
  await expect(page.getByRole("form", { name: /^Editing/ })).toHaveCount(0);
  const lunch = day.getByRole("listitem").filter({ hasText: "Lunch stop" });
  await expect(lunch.getByText("Order ahead")).toBeVisible();
  await expect(lunch.getByText("Saved ✓")).toBeVisible();
  await expect(day.getByRole("listitem").filter({ hasText: "Van pickup" }).getByText("Order ahead")).toHaveCount(0);

  // Unsaved changes are never thrown away by opening something else.
  await day.getByRole("listitem").filter({ hasText: "Van pickup" }).getByRole("button", { name: "More" }).click();
  await page.getByLabel("Notes", { exact: true }).fill("Bring the car seats");
  await day.getByRole("listitem").filter({ hasText: "Lunch stop" }).getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("form", { name: "Editing: Van pickup" })).toBeVisible();
  await expect(page.getByText("Save or cancel these changes first.")).toBeVisible();
  // The row's Close doesn't throw them away either; Cancel does.
  await day.getByRole("listitem").filter({ hasText: "Van pickup" }).getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("form", { name: "Editing: Van pickup" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("form", { name: /^Editing/ })).toHaveCount(0);
});
