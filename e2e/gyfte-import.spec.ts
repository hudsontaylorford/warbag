import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";
import { giftSheetBuffer } from "../tests/support/gift-sheet";

test("import a spreadsheet into a group, splitting a kids' tab", async ({ page }) => {
  const tag = randomUUID().slice(0, 4);
  await signIn(page, OWNER);
  await page.goto("/gyfte");
  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill(`Import ${tag}`);
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { name: `Import ${tag}` })).toBeVisible();

  await page.goto("/gyfte/import");
  if (await page.getByRole("button", { name: "Discard and start over" }).count()) {
    await page.getByRole("button", { name: "Discard and start over" }).click();
  }
  await page.getByLabel("Spreadsheet (.xlsx)").setInputFiles({
    name: "example-family.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await giftSheetBuffer({ siblings: true })),
  });
  await page.getByRole("button", { name: "Read spreadsheet" }).click();
  await expect(page.getByRole("heading", { name: "Review import" })).toBeVisible();

  // Choices first, group last: picking the group must not reset them.
  // The two-kid tab starts as "Kids together"; give it a parent and send the scooter to Kit.
  await page.locator("summary").filter({ hasText: "Kit and Lou" }).click();
  const kidsTab = page.locator("details").filter({ hasText: "Kit and Lou" });
  await expect(kidsTab.getByLabel("Who is this?")).toHaveValue("split");
  await kidsTab.getByLabel("Kit and Lou's parent").selectOption({ label: "Me" });
  await kidsTab.getByLabel("Who Scooter is for").selectOption("Kit");

  // Avery stays "just a name"; Sam is skipped.
  await page.locator("summary").filter({ hasText: /^Sam/ }).click();
  const samTab = page.locator("details").filter({ hasText: /^Sam/ });
  await samTab.getByLabel("Who is this?").selectOption("skip");

  await page.getByLabel("Put the lists in").selectOption({ label: `Import ${tag}` });
  await page.waitForTimeout(1500);
  expect(page.url()).not.toContain("group="); // picking a group no longer reloads the page
  await expect(samTab.getByLabel("Who is this?")).toHaveValue("skip");
  await expect(kidsTab.getByLabel("Kit and Lou's parent").locator("option:checked")).toHaveText("Me");
  await expect(kidsTab.getByLabel("Who Scooter is for")).toHaveValue("Kit");

  await page.getByRole("button", { name: /^Import \d+ gifts$/ }).click();
  await expect(page.getByRole("heading", { name: `Import ${tag}` })).toBeVisible();

  await page.getByRole("navigation", { name: "Years" }).getByRole("link", { name: "2025" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: /^↳ Kit/ }).first()).toContainText("1 gift ›");
  await expect(page.getByRole("listitem").filter({ hasText: "(together)" })).toContainText("2 gifts ›");
  await expect(page.getByRole("listitem").filter({ hasText: "Avery" }).first()).toContainText("gifts ›");
});
