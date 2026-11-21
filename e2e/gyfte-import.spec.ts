import { test, expect } from "@playwright/test";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";
import { giftSheetBuffer } from "../tests/support/gift-sheet";

test("import a gift spreadsheet: review, untick, import into History", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/gyfte");
  await page.getByRole("link", { name: "Import a spreadsheet ›" }).click();
  await page.getByLabel("Spreadsheet (.xlsx)").setInputFiles({
    name: "example-family.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await giftSheetBuffer()),
  });
  await page.getByRole("button", { name: "Read spreadsheet" }).click();

  await expect(page.getByRole("heading", { name: "Review import" })).toBeVisible();
  await expect(page.getByText(/Found \d+ gifts for 2 people, 2020 to 2025/)).toBeVisible();
  await page.locator("summary").filter({ hasText: "Avery" }).click();
  await expect(page.getByRole("checkbox", { name: /Clothes/ })).not.toBeChecked();
  await page.getByRole("checkbox", { name: /Hiking socks/ }).uncheck();
  await page.getByLabel("Which tab is you?").selectOption("");
  await page.getByRole("button", { name: /^Import \d+ lists/ }).click();

  await expect(page.getByText("Import done ✓")).toBeVisible();
  await page.getByText(/History \(\d+\)/).click();
  await page.getByRole("link", { name: /Avery · Christmas 2025/ }).click();
  await expect(page.getByText("Rain jacket")).toBeVisible();
  await expect(page.getByText("Hiking socks")).toHaveCount(0);
});
