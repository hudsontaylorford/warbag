import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("Mosey: make a trip, plan a day, add and schedule an idea, share a view link", async ({ page, browser }) => {
  const tag = randomUUID().slice(0, 4);
  await signIn(page, OWNER);
  await page.goto("/home");
  await page.getByRole("link", { name: /Mosey/ }).click();
  await page.getByRole("link", { name: "New trip" }).click();
  await page.getByLabel("Trip name").fill(`Maine ${tag}`);
  await page.getByLabel("Where").fill("Bar Harbor");
  await page.getByLabel("First day").fill("2027-06-05");
  await page.getByLabel("Last day").fill("2027-06-07");
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(page.getByRole("heading", { name: `Maine ${tag}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sat, Jun 5/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Mon, Jun 7/ })).toBeVisible();
  // The M header, with warbag as a quiet link home.
  await expect(page.getByRole("link", { name: "Mosey" })).toHaveAttribute("href", "/mosey");
  await expect(page.getByRole("link", { name: "warbag" })).toHaveAttribute("href", "/home");
  // The calendar jumps to a day's card.
  await expect(page.getByRole("navigation", { name: "Trip days" }).getByRole("link")).toHaveCount(3);
  await page.getByRole("link", { name: /Sunday, June 6/ }).click();
  await expect(page).toHaveURL(/#day-2027-06-06$/);

  // Plan a dinner on day 2 with a time and a members-only place.
  const day2 = page.getByRole("region", { name: /Sun, Jun 6/ });
  await expect(day2.getByLabel("Add to Sun, Jun 6")).toHaveCount(0); // no always-open add box
  await day2.getByRole("button", { name: "+ Add to this day" }).click();
  await day2.getByLabel("Add to Sun, Jun 6").fill("Lobster dinner");
  await day2.getByRole("button", { name: "Add a time, place, meal or link" }).click();
  // Typed like Crewmaxxing: a bare hour is read the likely way and says so.
  await day2.getByLabel("When").fill("6:30");
  await expect(day2.getByText("Read as 6:30 PM. Add a or p to change.")).toBeVisible();
  await day2.getByLabel("When").fill("soonish");
  await day2.getByLabel("Place", { exact: true }).click();
  await expect(day2.getByText(/isn't a time we recognize/)).toBeVisible();
  await day2.getByLabel("When").fill("6:30p");
  await day2.getByLabel("Place", { exact: true }).fill("Thurston's Lobster Pound");
  await day2.getByRole("button", { name: "Add", exact: true }).click();
  await expect(day2.getByText("Lobster dinner")).toBeVisible();
  await expect(day2.getByText("6:30 PM")).toBeVisible();
  await expect(day2.getByRole("link", { name: /Thurston's Lobster Pound/ })).toHaveAttribute("href", /google\.com\/maps\/search/);
  await expect(page.getByRole("link", { name: /Sunday, June 6.*1 planned/ })).toContainText("6:30p");

  // An optional area and tag for the day, shown quietly under its date.
  await day2.getByRole("button", { name: "Done adding" }).click();
  await day2.getByRole("button", { name: "More for this day" }).click();
  await day2.getByRole("button", { name: "Add area or tag" }).click();
  await day2.getByLabel("Area").fill("Bar Harbor → Acadia");
  await day2.getByLabel("Tag").fill("Travel day");
  await day2.getByLabel("Area").focus(); // leaving a field saves it
  await expect(day2.getByText("Saved ✓")).toBeVisible();
  await day2.getByRole("button", { name: "Done" }).click();
  await expect(day2.getByText("Day 2 · Bar Harbor → Acadia · Travel day")).toBeVisible();

  // A day collapses and opens again.
  await day2.getByRole("button", { name: /Sun, Jun 6/ }).click();
  await expect(day2.getByText("Lobster dinner")).toHaveCount(0);
  await expect(day2.getByText("1 planned")).toBeVisible();
  await day2.getByRole("button", { name: /Sun, Jun 6/ }).click();
  await expect(day2.getByText("Lobster dinner")).toBeVisible();

  // An idea, then onto the plan.
  await page.getByRole("link", { name: /^Ideas/ }).click();
  // Pasting a link files it as the link and asks what it is.
  await page.getByLabel("Add an idea").focus();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text", "https://example.com/beehive");
    document.activeElement!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(page.getByText("Link added below. Now say what it is.")).toBeVisible();
  await expect(page.getByLabel("Link", { exact: true })).toHaveValue("https://example.com/beehive");
  await expect(page.getByLabel("Add an idea")).toHaveValue("");
  await page.getByLabel("Add an idea").fill("Beehive trail");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("link", { name: /Beehive trail/ })).toHaveAttribute("href", "https://example.com/beehive");
  // A meal idea: who's handling it, and a Food & drink filter.
  await page.getByLabel("Add an idea").fill("Lobster bake at the house");
  await page.getByRole("button", { name: "Add a time, place, meal or link" }).click();
  await page.getByLabel("Meal").selectOption({ label: "Dinner" });
  await page.getByLabel("Who's handling it").fill("Ann cooking");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Handling it: Ann cooking")).toBeVisible();
  await page.getByRole("link", { name: "Food & drink (1)" }).click();
  await expect(page.getByText("Lobster bake at the house")).toBeVisible();
  await expect(page.getByRole("link", { name: /Beehive trail/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Move Lobster bake at the house to a day" }).click();
  await page.getByRole("button", { name: "Sat, Jun 5" }).click();
  await expect(page.getByText("No food or drink ideas.")).toBeVisible();
  await page.getByRole("link", { name: /^All/ }).click();

  // No day menu on every idea: one quiet action opens the days.
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.getByRole("button", { name: "Move Beehive trail to a day" }).click();
  await page.getByRole("button", { name: "Mon, Jun 7" }).click();
  await expect(page.getByText("No ideas yet.")).toBeVisible();
  await page.getByRole("link", { name: "Plan" }).click();
  const day3 = page.getByRole("region", { name: /Mon, Jun 7/ });
  await expect(day3.getByRole("link", { name: /Beehive trail/ })).toBeVisible();
  // An untimed dinner shows "Dinner" where the time goes.
  const day1meal = page.getByRole("region", { name: /Sat, Jun 5/ });
  await expect(day1meal.getByText("Dinner", { exact: true })).toBeVisible();
  await expect(day1meal.getByText("Handling it: Ann cooking")).toBeVisible();

  // A members-only stop, then the view link.
  const day1 = page.getByRole("region", { name: /Sat, Jun 5/ });
  await day1.getByRole("button", { name: "+ Add to this day" }).click();
  await day1.getByLabel("Add to Sat, Jun 5").fill("Check in");
  await day1.getByRole("button", { name: "Add a time, place, meal or link" }).click();
  await day1.getByRole("button", { name: "Afternoon" }).click();
  await expect(day1.getByRole("button", { name: "Afternoon" })).toHaveAttribute("aria-pressed", "true");
  await day1.getByLabel("Place", { exact: true }).fill("12 Private Road");
  await day1.getByLabel(/Members only/).check();
  await day1.getByRole("button", { name: "Add", exact: true }).click();
  await expect(day1.getByText("12 Private Road")).toBeVisible();
  await expect(day1.getByText("Afternoon", { exact: true })).toBeVisible();

  await page.locator("summary", { hasText: "Manage" }).click();
  // Settings save themselves: no Save buttons; renaming saves on leaving the field.
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  await page.getByLabel("Trip name").fill(`Maine ${tag} trip`);
  await page.getByLabel("Where").focus();
  await expect(page.getByRole("heading", { name: `Maine ${tag} trip` })).toBeVisible();
  await page.getByLabel("Trip name").fill(`Maine ${tag}`);
  await page.getByLabel("Where").focus();
  await expect(page.getByRole("heading", { name: `Maine ${tag}`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Make a trip link" }).click();
  const link = await page.getByLabel("Trip link").inputValue();
  expect(link).toMatch(/\/m\/[A-Za-z0-9_-]{32}$/);

  const guest = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: `Maine ${tag}` })).toBeVisible();
  await expect(guest.getByText("Lobster dinner")).toBeVisible();
  await expect(guest.getByText("Check in")).toBeVisible();
  await expect(guest.getByText("12 Private Road")).toHaveCount(0);
  await expect(guest.getByRole("button", { name: "More" })).toHaveCount(0);
  await expect(guest.getByLabel(/^Add to/)).toHaveCount(0);
  await expect(guest.getByRole("button", { name: /Add to this day|area or tag/ })).toHaveCount(0);
  await expect(guest.getByText("Day 2 · Bar Harbor → Acadia · Travel day")).toBeVisible();

  // Turned off, the link stops working.
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByRole("button", { name: "Make a trip link" })).toBeVisible();
  const res = await guest.goto(link);
  expect(res?.status()).toBe(404);
});
