import { test, expect } from "@playwright/test";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("make a Christmas list, add gifts fast, edit one, star, got it, delete", async ({ page }) => {
  await signIn(page, OWNER);
  await page.getByRole("link", { name: /Gyfte/ }).click();
  await page.getByRole("link", { name: "New list" }).click();
  await page.getByLabel("Your name").fill("Tester");
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page.getByRole("heading", { name: /^Tester · Christmas \d{4}$/ })).toBeVisible();

  const add = page.getByLabel("Add a gift");
  await add.fill("Wool socks");
  await add.press("Enter");
  await expect(page.getByText("Wool socks")).toBeVisible();
  await expect(add).toHaveValue("");
  await add.fill("https://www.amazon.com/Pilo-Fabric-Shaver/dp/B0ABCDEF12/ref=x?tag=y&th=1");
  await page.getByRole("button", { name: "Add" }).click();
  const shaver = page.getByRole("link", { name: /Pilo Fabric Shaver/ });
  await expect(shaver).toHaveAttribute("href", "https://www.amazon.com/dp/B0ABCDEF12");
  await expect(page.getByText("Amazon", { exact: true })).toBeVisible();

  // Edit the socks under More.
  const socks = page.getByRole("listitem").filter({ hasText: "Wool socks" });
  await socks.getByRole("button", { name: "More" }).click();
  await socks.getByLabel("Size").fill("L");
  await socks.getByLabel("Color").fill("Navy");
  await socks.getByRole("button", { name: "Save" }).click();
  await expect(socks.getByText("Saved ✓")).toBeVisible();
  await expect(socks.getByText("L · Navy")).toBeVisible();
  await socks.getByRole("button", { name: "Close" }).last().click();

  // Star moves it to the top.
  await socks.getByRole("button", { name: "Most wanted" }).click();
  await expect(socks.getByRole("button", { name: "Most wanted" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("listitem").first()).toContainText("Wool socks");

  // Got it moves the shaver under "Got it (1)".
  const shaverRow = page.getByRole("listitem").filter({ hasText: "Pilo Fabric Shaver" });
  await shaverRow.getByRole("button", { name: "More" }).click();
  await shaverRow.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByText("Got it (1)")).toBeVisible();

  // Delete the socks in two taps.
  await socks.getByRole("button", { name: "More" }).click();
  await socks.getByRole("button", { name: "Delete" }).click();
  await socks.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByText("Wool socks")).toHaveCount(0);

  // The launcher list counts what's still wanted.
  await page.getByRole("link", { name: "‹ Lists" }).click();
  await expect(page.getByRole("link", { name: /Tester · Christmas/ })).toContainText("0 gifts");
});

test("someone without Gyfte gets not found", async ({ page }) => {
  const res = await page.goto("/gyfte");
  expect(page.url()).toContain("/sign-in");
  expect(res?.ok()).toBe(true);
});
