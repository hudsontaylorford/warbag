import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { OWNER } from "../playwright.config";
import { signIn } from "./helpers";

/** A small real PNG (made up, a plain gray square) the browser can decode. */
function grayPng(size = 40): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 0, 0, 0, 0], 8); // 8-bit grayscale
  const rows = Buffer.concat(Array.from({ length: size }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(size, 180)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

test("Mosey receipts: a photo is kept privately with the expense; manual entry when AI isn't set up", async ({ page, browser }) => {
  const tag = randomUUID().slice(0, 4);
  await signIn(page, OWNER);
  await page.goto("/mosey/new");
  await page.getByLabel("Trip name").fill(`Receipts ${tag}`);
  await page.getByLabel("First day").fill("2027-06-05");
  await page.getByLabel("Last day").fill("2027-06-06");
  await page.getByRole("button", { name: "Create trip" }).click();
  await page.getByRole("link", { name: "Money" }).click();
  const add = page.locator("form").filter({ hasText: "Add someone" });
  await add.getByLabel("Name", { exact: true }).fill("Ann");
  await add.getByRole("button", { name: "Add person" }).click();
  await expect(page.locator('text="Ann" >> visible=true').first()).toBeVisible();

  await page.getByLabel("Add from a receipt photo").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: grayPng() });
  const review = page.locator("div").filter({ hasText: "See the photo" }).last();
  await expect(page.getByText("Reading receipts isn't set up yet. Fill it in by hand.")).toBeVisible();
  await review.getByLabel("What was it").fill("Corner store");
  await review.getByLabel("Amount ($)").fill("18.25");
  // From a photo the date is never guessed: it starts empty and must be chosen.
  await expect(review.getByLabel("Date")).toHaveValue("");
  await expect(review.getByText("Choose the date on the receipt.")).toBeVisible();
  await review.getByLabel("Date").fill("2027-06-05");
  await review.getByLabel("Paid by").selectOption({ label: "Ann" });
  await review.getByRole("button", { name: "Add expense" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Corner store" });
  await expect(row).toContainText("$18.25");
  const receipt = row.getByRole("link", { name: "Receipt ›" });
  const href = (await receipt.getAttribute("href"))!;

  // The owner can open it; someone signed out gets not found.
  const mine = await page.request.get(href);
  expect(mine.status()).toBe(200);
  expect(mine.headers()["content-type"]).toBe("image/jpeg"); // redrawn in the browser before upload
  expect(mine.headers()["cache-control"]).toContain("no-store");
  const stranger = await (await browser.newContext()).request.get(new URL(href, page.url()).toString());
  expect(stranger.status()).toBe(404);

  // A photo that isn't wanted can be discarded right away, or later from the list.
  await page.getByLabel("Add from a receipt photo").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: grayPng(41) });
  await page.getByRole("button", { name: "Discard photo" }).click();
  await expect(page.getByText("Photo discarded.")).toBeVisible();
  await page.getByLabel("Add from a receipt photo").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: grayPng(42) });
  await expect(page.getByRole("button", { name: "Discard photo" })).toBeVisible();
  await page.reload();
  await page.getByText("1 photo not saved as an expense").click();
  await page.getByRole("button", { name: "Use it" }).click();
  await expect(page.getByLabel("Date").first()).toHaveValue("");
  await page.getByRole("button", { name: "Discard photo" }).click();
  await expect(page.getByText("Photo discarded.")).toBeVisible();
  await expect(page.getByText("photo not saved as an expense")).toHaveCount(0);
});
