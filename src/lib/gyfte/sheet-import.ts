// Reads a family gift spreadsheet (.xlsx exported from Google Sheets) into
// draft lists for review. Pure: it takes a parsed workbook and returns data;
// nothing is saved here. Built around the family sheet's shape, generous
// about its quirks, and every guess is flagged so the reviewer can see it.
//
// The shape it expects, per person tab:
//   a title row ("Kim's List"), then a header row (Gift / Idea, Description,
//   Size, Color, Location, Other), then year sections ("2025", "2022 LIST:")
//   with one gift per row. Tabs without that header row (like "Home") are skipped.
//
// Quirks it handles:
//   - links hidden behind "Here", "Link 1", "Amazon" or a product title
//   - continuation rows (a ditto mark or "or ->" in the first column) merged
//     into the gift above as extra links or "Or: ..." notes
//   - "X" in the first column (older years) = received; strikethrough = received
//   - a price in the first column (one older section) moved to Price
//   - lone short lines ("Clothes", "RV TRAILER ITEMS BELOW") kept as unticked
//     "looks like a heading" rows
//   - sizes Google turned into dates ("10-12" -> a date) turned back
//   - rows before any year heading get the newest year in the file

import type ExcelJS from "exceljs";
import { HEADER_RE, details, linksIn, tidy } from "./bulk";
import { cleanLink, nameFromLink, parseLink } from "./links";

export type ImportedItem = {
  key: string;
  name: string;
  notes: string;
  size: string;
  color: string;
  price: string;
  links: string[];
  received: boolean;
  /** Ticked by default in the review? Headings start unticked. */
  include: boolean;
  /** Plain-words notes on what was guessed, shown in the review. */
  flags: string[];
};

export type ImportedList = { key: string; person: string; year: number; yearAssumed: boolean; items: ImportedItem[] };

export type SheetImport = {
  lists: ImportedList[];
  /** Tabs that didn't look like a person's list. */
  skippedTabs: string[];
  /** Rows left out entirely, with why. */
  skippedRows: { person: string; row: number; text: string; reason: string }[];
};

type Cell = { text: string; links: string[]; firstRawLink: string; strike: boolean; date: Date | null; number: number | null };

const YEAR_TEXT = /^((?:19|20)\d{2})(?:\s*list)?\s*:?$/i;
const PLACEHOLDER = /^(here|link\s*\d*|links?|amazon|see (above|link)|or|or this one\s*>*|or\s*-*>+.*|good list.*|.*-{3,}>|\^|")$/i;
const CONTINUATION = /^("|''|or\b.*|or\s*>+|or\s*-+>?)$/i;
const MARKER_X = /^x$/i;
const PRICE_ONLY = /^\$?\s?\d{1,5}(?:\.\d{1,2})?(?:\s*-\s*\$?\s?\d{1,5})?$/;

function cellOf(c: ExcelJS.Cell | undefined, col: number): Cell {
  const empty: Cell = { text: "", links: [], firstRawLink: "", strike: false, date: null, number: null };
  if (!c || c.value === null || c.value === undefined) return empty;
  const v = c.value as unknown;
  let text = "";
  let hyperlink = "";
  let date: Date | null = null;
  let number: number | null = null;

  if (typeof v === "string") text = v;
  else if (typeof v === "number") {
    number = v;
    text = Number.isInteger(v) ? String(v) : String(v);
  } else if (v instanceof Date) {
    date = v;
  } else if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: unknown; hyperlink?: string; result?: unknown };
    if (o.hyperlink) {
      hyperlink = o.hyperlink;
      const t = o.text as { richText?: { text: string }[] } | string | undefined;
      text = typeof t === "string" ? t : (t?.richText?.map((r) => r.text).join("") ?? "");
    } else if (o.richText) text = o.richText.map((r) => r.text).join("");
    else if (o.result !== undefined && o.result !== null) text = String(o.result);
  }

  const found = linksIn(text);
  const links = [...found.links];
  let firstRawLink = found.firstRaw;
  if (hyperlink && parseLink(hyperlink)) {
    links.unshift(cleanLink(hyperlink));
    firstRawLink = hyperlink;
  }
  let rest = tidy(found.rest);
  // A link's label ("Here", "Link 1", a long product title in Location) isn't content.
  if (hyperlink && (col >= 2 || PLACEHOLDER.test(rest))) rest = "";
  if (PLACEHOLDER.test(rest) && links.length > 0) rest = "";

  return { text: rest, links: [...new Set(links)], firstRawLink, strike: Boolean(c.font?.strike), date, number };
}

function sizeText(c: Cell): { text: string; flag?: string } {
  if (c.date) {
    // Google Sheets turns sizes like "10-12" into dates. Turn them back.
    return { text: `${c.date.getUTCMonth() + 1}-${c.date.getUTCDate()}`, flag: "Size looked like a date; read as month-day" };
  }
  return { text: c.text };
}

function yearOf(c: Cell): number | null {
  if (c.number !== null && Number.isInteger(c.number) && c.number >= 1990 && c.number <= 2100) return c.number;
  const m = c.text.match(YEAR_TEXT);
  return m ? Number(m[1]) : null;
}

// Words that make up section headings in gift lists ("Home Stuff", "Music Equipment").
const HEADING_WORDS = new Set(
  ("clothes clothing apparel shoes socks home house household kitchen cooking books music audio tools " +
    "appliances equipment gear stuff things items other misc miscellaneous random toys games accessories " +
    "jewelry beauty outdoor outdoors sports tech electronics art decor for the and below above list").split(" "),
);

function looksLikeHeading(text: string): boolean {
  const clean = text.replace(/[!:.]+$/, "").trim();
  const letters = clean.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 4 && letters === letters.toUpperCase()) return true;
  const words = clean.toLowerCase().split(/[\s&/]+/).filter(Boolean);
  return words.length > 0 && words.length <= 4 && words.every((w) => HEADING_WORDS.has(w));
}

function rowCells(row: ExcelJS.Row, width: number): Cell[] {
  const cells: Cell[] = [];
  for (let col = 1; col <= width; col++) cells.push(cellOf(row.getCell(col), col));
  return cells;
}

function headerRowOf(ws: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const texts = rowCells(ws.getRow(r), 8).map((c) => c.text.toLowerCase());
    if (texts.some((t) => /gift\s*\/?\s*idea/.test(t)) || (texts.includes("description") && texts.includes("location"))) return r;
  }
  return null;
}

/** The newest year heading anywhere in the workbook (for rows before any heading). */
function newestYear(wb: ExcelJS.Workbook): number {
  let newest = 0;
  wb.eachSheet((ws) => {
    ws.eachRow((row) => {
      const y = yearOf(cellOf(row.getCell(1), 1));
      if (y && y > newest) newest = y;
    });
  });
  return newest || new Date().getUTCFullYear() - 1;
}

export function readGiftSheet(wb: ExcelJS.Workbook): SheetImport {
  const result: SheetImport = { lists: [], skippedTabs: [], skippedRows: [] };
  const fallbackYear = newestYear(wb);

  wb.eachSheet((ws) => {
    const person = ws.name.trim();
    const header = headerRowOf(ws);
    if (header === null) {
      result.skippedTabs.push(person);
      return;
    }
    const lists = new Map<number, ImportedList>();
    let year = fallbackYear;
    let yearAssumed = true;
    let previous: ImportedItem | null = null;
    const width = Math.max(ws.columnCount, 6);

    const listFor = (y: number, assumed: boolean) => {
      let list = lists.get(y);
      if (!list) {
        list = { key: `${person}|${y}`, person, year: y, yearAssumed: assumed, items: [] };
        lists.set(y, list);
      }
      return list;
    };

    for (let r = header + 1; r <= ws.rowCount; r++) {
      let cells = rowCells(ws.getRow(r), width);
      const anyContent = cells.some((c) => c.text || c.links.length || c.date);
      if (!anyContent) continue;

      // Year heading.
      const y = yearOf(cells[0]);
      if (y && cells.slice(1).every((c) => !c.text && !c.links.length)) {
        year = y;
        yearAssumed = false;
        previous = null;
        continue;
      }

      // A header row repeated mid-sheet.
      const texts = cells.map((c) => c.text).filter(Boolean);
      if (texts.length > 0 && texts.every((t) => HEADER_RE.test(t))) continue;

      // Markers in the first column: X (received), ? , or a price.
      const flags: string[] = [];
      let received = false;
      let price = "";
      const first = cells[0].text;
      const secondHasText = Boolean(cells[1]?.text);
      if (MARKER_X.test(first) && secondHasText) {
        received = true;
        flags.push("Marked X: read as Got it");
        cells = [...cells.slice(1), cellOf(undefined, 0)];
      } else if (first === "?" && secondHasText) {
        flags.push("Marked ?");
        cells = [...cells.slice(1), cellOf(undefined, 0)];
      } else if ((PRICE_ONLY.test(first) || cells[0].number !== null) && secondHasText && !cells[0].links.length) {
        price = /^\$/.test(first) ? first : `$${first}`;
        flags.push("Price taken from the first column");
        cells = [...cells.slice(1), cellOf(undefined, 0)];
      }

      // Continuation rows: a ditto mark, "or ->", or links with no name.
      const lead = cells[0].text;
      const isContinuation =
        CONTINUATION.test(lead) || (!lead && !cells[1]?.text && cells.some((c) => c.links.length > 0));
      if (isContinuation) {
        if (!previous) {
          result.skippedRows.push({ person, row: r, text: lead || "(links)", reason: "Continuation row with nothing above it" });
          continue;
        }
        const extraLinks = cells.flatMap((c) => c.links);
        const extraText = cells
          .slice(1)
          .map((c) => c.text)
          .filter((t) => t && !PLACEHOLDER.test(t));
        previous.links = [...new Set([...previous.links, ...extraLinks])].slice(0, 5);
        if (extraText.length) previous.notes = [previous.notes, `Or: ${extraText.join(", ")}`].filter(Boolean).join("\n");
        if (!previous.flags.includes("Merged with the row below it")) previous.flags.push("Merged with the row below it");
        continue;
      }

      // The gift itself.
      let nameCell = cells[0];
      let rest = cells.slice(1);
      if (!nameCell.text && rest[0]?.text) {
        nameCell = rest[0];
        rest = rest.slice(1);
        flags.push("Name found in the second column");
      }
      const fromName = details(nameCell.text);
      let name = tidy(fromName.rest) || nameCell.text;
      const allLinks = [...new Set(cells.flatMap((c) => c.links))].slice(0, 5);
      const rawLink = cells.find((c) => c.firstRawLink)?.firstRawLink ?? "";
      if (!name && rawLink) {
        name = nameFromLink(rawLink);
        flags.push("Name made from the link");
      }
      if (!name) {
        result.skippedRows.push({ person, row: r, text: cells.map((c) => c.text).join(" ").slice(0, 80), reason: "No gift name" });
        continue;
      }
      const [description, sizeCell, color, location, ...others] = rest;
      const size = sizeCell ? sizeText(sizeCell) : { text: "" };
      if (size.flag) flags.push(size.flag);
      if (cells.some((c) => c.strike)) {
        received = true;
        flags.push("Struck through: read as Got it");
      }
      const onlyName = !rest.some((c) => c && (c.text || c.links.length || c.date)) && allLinks.length === 0;
      const heading = onlyName && looksLikeHeading(name) && !received;
      if (heading) flags.push("Looks like a heading, not a gift");

      const item: ImportedItem = {
        key: `${person}|${r}`,
        name: name.slice(0, 200),
        notes: [description?.text, location?.text, ...others.map((c) => c?.text)]
          .filter((t): t is string => Boolean(t) && !PLACEHOLDER.test(t!))
          .join("\n")
          .slice(0, 1000),
        size: (size.text || fromName.size).slice(0, 80),
        color: (color?.text || fromName.color).slice(0, 80),
        price: (price || fromName.price).slice(0, 40),
        links: allLinks,
        received,
        include: !heading,
        flags,
      };
      listFor(year, yearAssumed).items.push(item);
      previous = heading ? null : item;
    }

    const ordered = [...lists.values()].filter((l) => l.items.length > 0).sort((a, b) => b.year - a.year);
    result.lists.push(...ordered);
  });

  return result;
}
