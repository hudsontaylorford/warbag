import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readGiftSheet } from "@/lib/gyfte/sheet-import";
import { giftSheetBuffer } from "../support/gift-sheet";

async function read() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await giftSheetBuffer());
  return readGiftSheet(wb);
}

describe("reading a gift spreadsheet", () => {
  it("makes one list per person per year, newest first, skipping non-list tabs", async () => {
    const r = await read();
    expect(r.skippedTabs).toEqual(["Home"]);
    expect(r.lists.map((l) => l.key)).toEqual(["Avery|2025", "Avery|2024", "Avery|2020", "Sam|2025", "Sam|2020"]);
  });

  it("assumes the newest year for rows before any year heading, and says so", async () => {
    const sam = (await read()).lists.find((l) => l.key === "Sam|2025")!;
    expect(sam.yearAssumed).toBe(true);
    expect(sam.items.map((i) => i.name)).toEqual(["Board game"]);
  });

  it("finds links behind labels and drops the labels", async () => {
    const jacket = (await read()).lists[0].items.find((i) => i.name === "Rain jacket")!;
    expect(jacket).toMatchObject({ size: "M", color: "Green", notes: "Lightweight", links: ["https://shop.example.com/jacket"] });
  });

  it("merges a ditto row into the gift above", async () => {
    const steel = (await read()).lists[0].items.find((i) => i.name === "Lap steel guitar")!;
    expect(steel.links).toEqual(["https://music.example.com/item/1-lap-steel", "https://music.example.com/item/2-lap-steel"]);
    expect(steel.notes).toBe("Older is better");
    expect(steel.flags).toContain("Merged with the row below it");
  });

  it("keeps headings as unticked rows", async () => {
    const heading = (await read()).lists[0].items.find((i) => i.name === "Clothes")!;
    expect(heading.include).toBe(false);
    expect(heading.flags).toContain("Looks like a heading, not a gift");
  });

  it("turns a size that became a date back into month-day", async () => {
    const socks = (await read()).lists[0].items.find((i) => i.name === "Hiking socks")!;
    expect(socks.size).toBe("10-12");
  });

  it("reads strikethrough and X as received, and shifts past the X", async () => {
    const r = await read();
    expect(r.lists[1].items[0]).toMatchObject({ name: "Cast iron pan", received: true });
    const old = r.lists[2].items;
    expect(old[0]).toMatchObject({ name: "Steak knives", notes: "Sharp", received: true });
    expect(old[1]).toMatchObject({ name: "Coffee mug", notes: "For mornings", size: "12 oz", color: "Blue", received: false });
  });

  it("moves a price in the first column to Price", async () => {
    const camera = (await read()).lists.find((l) => l.key === "Sam|2020")!.items[0];
    expect(camera).toMatchObject({ name: "Film camera", price: "$25", notes: "Something fun" });
  });
});
