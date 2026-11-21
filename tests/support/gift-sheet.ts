import ExcelJS from "exceljs";

/**
 * A made-up gift spreadsheet with the same shape and quirks as the family
 * sheet: a Home tab, title and header rows, year sections, links behind
 * "Here" and "Link 1", a ditto continuation row, X marks, strikethrough,
 * a price column, headings, a size turned into a date, and a tab whose
 * first section has no year. Fictional people and gifts only.
 */
export async function makeGiftSheet(opts: { siblings?: boolean } = {}): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const home = wb.addWorksheet("Home");
  home.addRow(["2025 Example Family Gifting"]);
  home.addRow(["Avery"]);

  const header = ["Gift / Idea", "Description", "Size", "Color", "Location", "Other"];
  const link = (text: string, hyperlink: string) => ({ text, hyperlink });

  const avery = wb.addWorksheet("Avery");
  avery.addRow(["Avery's List"]);
  avery.addRow(header);
  avery.addRow([2025]);
  avery.addRow(["Clothes"]);
  avery.addRow(["Rain jacket", "Lightweight", "M", "Green", link("Here", "https://shop.example.com/jacket?utm_source=x")]);
  avery.addRow(["Lap steel guitar", "Older is better", "", "", link("Link 1", "https://music.example.com/item/1-lap-steel")]);
  avery.addRow(['"', "", "", "", link("Link 2", "https://music.example.com/item/2-lap-steel")]);
  avery.addRow(["Hiking socks", "", new Date(Date.UTC(2024, 9, 12)), "", ""]);
  avery.addRow(["2024"]);
  const struck = avery.addRow(["Cast iron pan", "10 inch", "", "", link("https://shop.example.com/pan", "https://shop.example.com/pan")]);
  struck.getCell(1).font = { strike: true };
  avery.addRow(["2020 LIST:"]);
  avery.addRow(["X", "Steak knives", "Sharp", "", "", link("https://shop.example.com/knives", "https://shop.example.com/knives")]);
  avery.addRow(["", "Coffee mug", "For mornings", "12 oz", "Blue"]);

  const sam = wb.addWorksheet("Sam");
  sam.addRow(["Sam's List"]);
  sam.addRow(header);
  sam.addRow(["Board game"]);
  sam.addRow(["2020 LIST:"]);
  sam.addRow([25, "Film camera", "Something fun", "", "", link("https://shop.example.com/camera", "https://shop.example.com/camera")]);
  if (opts.siblings) {
    // A tab for two kids together, like the family sheet's joint tab.
    const kids = wb.addWorksheet("Kit and Lou");
    kids.addRow(["Kit and Lou"]);
    kids.addRow(header);
    kids.addRow([2025]);
    kids.addRow(["Scooter", "For Kit", "", "Red"]);
    kids.addRow(["Play kitchen", "For both to share"]);
    kids.addRow(["Picture books", "Lou loves animals"]);
  }
  return wb;
}

export async function giftSheetBuffer(opts: { siblings?: boolean } = {}): Promise<ArrayBuffer> {
  const wb = await makeGiftSheet(opts);
  const buf = await wb.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf as unknown as Buffer).buffer;
}
