import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

test("Mosey notes: bullets and paragraphs, long notes fold; day tools stay folded", async ({ page }) => {
  const tag = randomUUID().slice(0, 4);
  await signIn(page, OWNER);
  await page.goto("/mosey/new");
  await page.getByLabel("Trip name").fill(`Notes ${tag}`);
  await page.getByLabel("First day").fill("2027-09-01");
  await page.getByLabel("Last day").fill("2027-09-01");
  await page.getByRole("button", { name: "Create trip" }).click();
  const day = page.getByRole("region", { name: /Wed, Sep 1/ });

  // "‹ Trips" has a full-size tap target.
  const back = page.getByRole("link", { name: "‹ Trips" });
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await day.getByRole("button", { name: "+ Add to this day" }).click();
  await day.getByLabel(/^Add to/).fill("Skiing");
  await day.getByRole("button", { name: "Add", exact: true }).click();
  await day.getByRole("button", { name: "Done adding" }).click();

  // Only the main action shows; the rest is one tap away.
  await expect(day.getByRole("button", { name: "+ Add options" })).toHaveCount(0);
  await day.getByRole("button", { name: "More for this day" }).click();
  await expect(day.getByRole("button", { name: "+ Add options" })).toBeVisible();
  await expect(day.getByRole("button", { name: "Add area, tag or staying" })).toBeVisible();
  await day.getByRole("button", { name: "Fewer" }).click();
  await expect(day.getByRole("button", { name: "+ Add options" })).toHaveCount(0);

  const row = day.getByRole("listitem").filter({ hasText: "Skiing" }).first();
  await row.getByRole("button", { name: "More about Skiing" }).click();
  await page
    .getByLabel("Notes", { exact: true })
    .fill(
      "Optional, subject to snow.\n- Tickets\n- Rentals\n- Lessons\n\nPlan separately for non-skiers. Child lessons start at 3; tubing needs 42 inches and solo riding. Recheck before booking, since hours change in holiday week and the mountain posts updates late.",
    );
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // On a day card a long note shows only its first line until Show all.
  await expect(row.getByText("Optional, subject to snow.", { exact: true })).toBeVisible();
  await expect(row.getByRole("listitem").filter({ hasText: "Rentals" })).toHaveCount(0);
  await row.getByRole("button", { name: "Show all" }).click();
  await expect(row.getByRole("listitem").filter({ hasText: "Rentals" })).toHaveCount(1);
  await expect(row.getByText("Recheck before booking", { exact: false })).toBeVisible();
  await expect(row.getByRole("button", { name: "Show less" })).toBeVisible();
});
