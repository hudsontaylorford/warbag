import { test, expect } from "@playwright/test";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("set your name on Account; new lists for you use it", async ({ page }) => {
  await signIn(page, OWNER);
  await page.getByRole("link", { name: "Account" }).click();
  await expect(page.getByText(OWNER)).toBeVisible();
  // Saves itself: no Save button, just Return (or leaving the field).
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  await page.getByLabel("Your name").fill("Owner Person");
  await page.getByLabel("Your name").press("Enter");
  await expect(page.getByText("Saved ✓")).toBeVisible();

  await page.goto("/gyfte/new");
  await expect(page.getByLabel("Your name")).toHaveValue("Owner Person");
});
