import { test, expect, type Browser } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { sentTo, signIn } from "./helpers";

async function freshPage(browser: Browser) {
  return (await browser.newContext({ ...test.info().project.use })).newPage();
}

test("Mosey: from a trip link to on the trip, and clear words when you're not", async ({ page, browser }) => {
  const tag = randomUUID().slice(0, 4);
  const email = `cousin-${randomUUID().slice(0, 8)}@example.test`;
  await signIn(page, OWNER);
  await page.goto("/mosey/new");
  await page.getByLabel("Trip name").fill(`Lake ${tag}`);
  await page.getByLabel("First day").fill("2027-07-01");
  await page.getByLabel("Last day").fill("2027-07-03");
  await page.getByRole("button", { name: "Create trip" }).click();
  await page.waitForURL(/mosey\/[0-9a-f-]{36}$/);
  const tripUrl = page.url();
  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "Make a trip link" }).click();
  const link = await page.getByLabel("Trip link").inputValue();

  // Someone with the link asks to join; nothing is created yet.
  const cousin = await freshPage(browser);
  await cousin.goto(link);
  await expect(cousin.getByRole("heading", { name: "Join this trip" })).toBeVisible();
  await cousin.getByLabel("Your name").fill("Cousin Kay");
  await cousin.getByLabel("Your email").fill(email);
  await cousin.getByRole("button", { name: "Ask to join" }).click();
  await expect(cousin.getByText("When the organizer adds you, we'll email you")).toBeVisible();
  expect(sentTo(email)).toHaveLength(0);

  // The owner adds them from Manage; they're emailed how to sign in.
  // A notice at the top of the trip goes straight to the request (Manage opens by itself).
  await page.reload();
  await page.getByRole("link", { name: /1 asking to join/ }).click();
  await expect(page.locator("#asking").getByText("Cousin Kay")).toBeInViewport();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Nobody yet.")).toBeVisible();
  await expect.poll(() => sentTo(email).some((m) => m.subject.endsWith(`added you to Lake ${tag}`))).toBe(true);

  // Now they sign in and the trip is theirs to open.
  const again = await freshPage(browser);
  await signIn(again, email);
  await again.goto("/mosey");
  await again.getByRole("link", { name: new RegExp(`Lake ${tag}`) }).click();
  await expect(again.getByRole("heading", { name: `Lake ${tag}` })).toBeVisible();
  await again.goto(link);
  await expect(again.getByText("You're on this trip.")).toBeVisible();

  // Someone who only has Mosey sees Mosey, not warbag: no warbag link, and "home" is their trips.
  await again.goto(tripUrl.replace(/.*\/mosey\//, "/mosey/"));
  await expect(again.getByRole("link", { name: "warbag", exact: true })).toHaveCount(0);
  await expect(again).toHaveTitle("Trip · Mosey");
  await again.goto("/home");
  await expect(again).toHaveURL(/\/mosey$/);
  await expect(again.locator("body")).not.toContainText("warbag");

  // Invite by email from Manage: a sign-in and the trip in one step.
  const email2 = `uncle-${randomUUID().slice(0, 8)}@example.test`;
  await page.getByLabel("Their name").fill("Uncle Lou");
  await page.getByLabel("Their email").fill(email2);
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByText(`Added ${email2} and emailed them how to sign in ✓`)).toBeVisible();
  await expect.poll(() => sentTo(email2).length).toBeGreaterThan(0);

  // Someone signed in with no trips sees who they're signed in as, not a dead end.
  const nobody = `nobody-${randomUUID().slice(0, 8)}@example.test`;
  await page.goto("/admin");
  await page.getByLabel("Email", { exact: true }).fill(nobody);
  await page.getByLabel("Email them how to sign in").uncheck();
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(`Added ${nobody}`)).toBeVisible();
  const empty = await freshPage(browser);
  await signIn(empty, nobody);
  await empty.goto("/mosey");
  await expect(empty.getByText("No trips shared with you yet.")).toBeVisible();
  await expect(empty.getByText(nobody)).toBeVisible();
  await empty.goto(tripUrl.replace(/.*\/mosey\//, "/mosey/"));
  await expect(empty.getByRole("heading", { name: "This trip isn't shared with you" })).toBeVisible();
  // ...and can ask to join right there, as themselves; the owner sees it under Manage.
  await empty.getByLabel("Your name").fill("Newcomer");
  await empty.getByRole("button", { name: "Ask to join" }).click();
  await expect(empty.getByText(`When the organizer adds you, we'll email ${nobody}`)).toBeVisible();
  await page.goto(tripUrl);
  await expect(page.getByText("· 1 asking to join")).toBeVisible();

  // People and Account remember the trip: "‹ Back to" returns to it.
  await page.getByRole("link", { name: "People", exact: true }).click();
  await page.getByRole("link", { name: new RegExp(nobody) }).click(); // a person's page keeps it too
  await expect(page.getByRole("link", { name: "‹ People" })).toBeVisible();
  await page.getByRole("link", { name: `‹ Back to Lake ${tag}` }).click();
  await expect(page).toHaveURL(tripUrl);
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page.getByRole("link", { name: `‹ Back to Lake ${tag}` }).click();
  await expect(page).toHaveURL(tripUrl);

  // Signed out on a trip's own address: the sign-in page says it's private and points at the trip link.
  const out = await freshPage(browser);
  await out.goto(tripUrl.replace(/.*\/mosey\//, "/mosey/"));
  await expect(out.getByText("This trip is private.")).toBeVisible();
  await expect(out.getByRole("heading", { name: "Sign in to Mosey" })).toBeVisible();
});
