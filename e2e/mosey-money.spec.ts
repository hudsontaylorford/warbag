import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("Mosey money: people and a couple, expenses, a prepaid share, settle up, freeze", async ({ page, browser }) => {
  const tag = randomUUID().slice(0, 4);
  await signIn(page, OWNER);
  await page.goto("/mosey/new");
  await page.getByLabel("Trip name").fill(`Money ${tag}`);
  await page.getByLabel("First day").fill("2027-06-05");
  await page.getByLabel("Last day").fill("2027-06-06");
  await page.getByRole("button", { name: "Create trip" }).click();
  await page.getByRole("link", { name: "Money" }).click();
  await expect(page.getByText("Add the people on this trip first")).toBeVisible();

  // People: Ann + Ben share a household; Cal is on their own.
  for (const [name, household] of [["Ann", "Ann + Ben"], ["Ben", "Ann + Ben"], ["Cal", ""]]) {
    const add = page.locator("form").filter({ hasText: "Add someone" });
    await add.getByLabel("Name", { exact: true }).fill(name);
    await add.getByLabel("Household", { exact: true }).fill(household);
    await add.getByRole("button", { name: "Add person" }).click();
    await expect(page.locator(`text="${name}" >> visible=true`).first()).toBeVisible();
  }

  // A kid: on the trip, but left out of splits unless ticked in, and never the payer.
  {
    const add = page.locator("form").filter({ hasText: "Add someone" });
    await add.getByLabel("Name", { exact: true }).fill("Kit");
    await add.getByLabel("Household", { exact: true }).fill("Ann + Ben");
    await add.getByLabel(/^Kid/).check();
    await add.getByRole("button", { name: "Add person" }).click();
    await expect(page.getByText("Kid · Household: Ann + Ben")).toBeVisible();
  }
  await expect(page.getByRole("checkbox", { name: "Kit" })).not.toBeChecked();
  await expect(page.getByLabel("Paid by").locator("option", { hasText: "Kit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "All adults" })).toBeVisible();

  // $120 dinner paid by Cal, split by all three adults.
  await page.getByLabel("What was it").fill("Dinner");
  await page.getByLabel("Amount ($)").first().fill("120");
  await page.getByLabel("Paid by").selectOption({ label: "Cal" });
  await expect(page.getByText("Split 3 ways, about $40.00 each.")).toBeVisible();
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Dinner" })).toContainText("$120.00");

  // Nobody in the split can't be saved.
  await page.getByLabel("What was it").fill("Ghost");
  await page.getByRole("button", { name: "Nobody" }).click();
  await expect(page.getByRole("button", { name: "Add expense" })).toBeDisabled();
  await page.getByRole("button", { name: "All adults" }).click();
  await page.getByLabel("What was it").fill("");

  // Ann already paid Cal $40.
  await page.locator("summary", { hasText: "Payments already made" }).click();
  const pay = page.locator("form").filter({ hasText: "Record payment" });
  await pay.getByLabel("Who paid").selectOption({ label: "Ann" });
  await pay.getByLabel("Paid to").selectOption({ label: "Cal" });
  await pay.getByLabel("Amount ($)").fill("40");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Recorded ✓")).toBeVisible();

  // Settle: the Ann + Ben household owes Cal $40 (two shares, minus Ann's $40).
  await page.getByRole("link", { name: "Settle up ›" }).click();
  await expect(page.getByRole("heading", { name: "One payment settles it" })).toBeVisible();
  const line = page.getByRole("listitem").filter({ hasText: "sends" });
  await expect(line).toContainText("Ann + Ben sends Cal");
  await expect(line).toContainText("$40.00");
  await expect(page.getByText("Everything balances ✓")).toBeVisible();
  await expect(page.getByLabel("Message for the group")).toHaveValue(/Ann \+ Ben → Cal: \$40\.00/);

  // Through Cal gives the same single payment.
  await page.locator("summary", { hasText: "How to settle" }).click();
  await page.getByLabel("Everyone settles with one person").check();
  await page.getByLabel("Who collects and pays out").selectOption({ label: "Cal" });
  await page.getByRole("button", { name: "Use this" }).click();
  await expect(page.getByText("Everyone settles with Cal.").first()).toBeVisible();
  await expect(line).toContainText("$40.00");

  await page.getByRole("button", { name: "Freeze this version" }).click();
  await expect(page.getByText("Saved as version 1 ✓")).toBeVisible();
  await expect(page.locator("summary", { hasText: "Version 1" })).toBeVisible();

  // The view link never shows money.
  const trip = page.url().split("/money")[0];
  await page.goto(trip);

  // A booked stop, and who's going, from the same people.
  const day1 = page.getByRole("region", { name: /Sat, Jun 5/ });
  await day1.getByRole("button", { name: "+ Add to this day" }).click();
  await day1.getByLabel(/^Add to/).fill("Boat tour");
  await day1.getByRole("button", { name: "Add a time, place, meal or link" }).click();
  await day1.getByLabel("Status").selectOption({ label: "Booked" });
  await day1.getByLabel(/Ask who's going/).check();
  await day1.getByRole("button", { name: "Add", exact: true }).click();
  await expect(day1.getByText("Booked", { exact: true })).toBeVisible();
  // A stop that doesn't ask shows nothing about attendance.
  await day1.getByLabel(/^Add to/).fill("Lunch");
  await day1.getByRole("button", { name: "Add", exact: true }).click();
  await expect(day1.getByText("Lunch", { exact: true })).toBeVisible();
  await day1.getByRole("button", { name: "Done adding" }).click();
  await expect(day1.getByRole("button", { name: "Who's going?" })).toHaveCount(1);
  await day1.getByRole("button", { name: "Who's going?" }).click();
  await day1.getByRole("group", { name: "Ann: going?" }).getByRole("button", { name: "Going" }).click();
  await expect(day1.getByRole("group", { name: "Ann: going?" }).getByRole("button", { name: "Going" })).toHaveAttribute("aria-pressed", "true");
  await day1.getByRole("group", { name: "Cal: going?" }).getByRole("button", { name: "Maybe" }).click();
  await day1.getByRole("button", { name: "Done" }).click();
  await expect(day1.getByText("Going: Ann · Maybe: Cal")).toBeVisible();

  await page.locator("summary", { hasText: "Manage" }).click();
  await page.getByRole("button", { name: "Make a view link" }).click();
  const link = await page.getByLabel("View link").inputValue();
  const guest = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: `Money ${tag}` })).toBeVisible();
  await expect(guest.getByRole("link", { name: "Money" })).toHaveCount(0);
  await expect(guest.getByText("Dinner")).toHaveCount(0);
  // The view link shows the stop and its status, never who's going.
  await expect(guest.getByText("Boat tour")).toBeVisible();
  await expect(guest.getByText("Booked", { exact: true })).toBeVisible();
  await expect(guest.getByText(/Going:|Who's going/)).toHaveCount(0);
  const res = await guest.goto(`${trip.replace(/.*\/mosey\//, "/mosey/")}/money`);
  expect(guest.url()).toContain("/sign-in");
  expect(res?.status()).toBeLessThan(500);
});
