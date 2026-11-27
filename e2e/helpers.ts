import { readFileSync, existsSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { OUTBOX } from "../playwright.config";

type Sent = { to: string; subject: string; text: string };

export function sentTo(email: string): Sent[] {
  if (!existsSync(OUTBOX)) return [];
  return readFileSync(OUTBOX, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Sent)
    .filter((m) => m.to === email);
}

export async function latestCode(email: string): Promise<string> {
  let code = "";
  await expect
    .poll(() => {
      const last = sentTo(email).at(-1);
      code = last?.text.match(/\b(\d{6})\b/)?.[1] ?? "";
      return code;
    })
    .not.toBe("");
  return code;
}

export async function requestCode(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText(`If ${email} has access`)).toBeVisible();
}

/** Signs in through the real form, reading the code from the test outbox. */
export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await requestCode(page, email);
  await page.getByLabel("Code").fill(await latestCode(email));
  await page.getByRole("button", { name: "Sign in" }).click();
  // The launcher, or straight into someone's only app.
  await expect(page).toHaveURL(/\/(home|mosey|gyfte|roomtune|jot)$/);
}
