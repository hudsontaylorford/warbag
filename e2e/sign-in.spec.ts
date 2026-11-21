import { test, expect } from "@playwright/test";
import { OWNER } from "../playwright.config";
import { latestCode, requestCode, sentTo } from "./helpers";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fhome$/);
  await expect(page.getByRole("heading", { name: "Sign in to warbag" })).toBeVisible();
});

test("an email without access gets the same reply and no code", async ({ page }) => {
  const stranger = "stranger@example.test";
  await page.goto("/sign-in");
  await requestCode(page, stranger);
  // Give a would-be email time to land, then confirm none did.
  await page.waitForTimeout(1000);
  expect(sentTo(stranger)).toHaveLength(0);
});

test("the owner signs in with a code, and signs out", async ({ page }) => {
  // A hostile ?next= must not send people off-site after sign-in.
  await page.goto("/sign-in?next=//evil.example");
  await requestCode(page, OWNER);
  const code = await latestCode(OWNER);

  const wrong = code === "000000" ? "111111" : "000000";
  await page.getByLabel("Code").fill(wrong);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That code didn't work")).toBeVisible();

  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: /^(Hi, |Home$)/ })).toBeVisible();

  await page.getByRole("link", { name: "Account" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/sign-in/);
});
