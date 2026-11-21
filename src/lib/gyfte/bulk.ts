// Bulk add: turn pasted text into gifts, generously. Pure functions, used
// in the browser for the live preview and again on the server (which never
// trusts the browser's version).
//
// What it understands, one gift per line:
//   - plain lines, bullets ("- ", "• ", "* "), numbers ("1." "2)"), checkboxes ("[ ]")
//   - links anywhere on the line (the rest of the line is the name; a bare
//     link gets a name from its address)
//   - prices ("$40", "under $30", "~$25"), sizes ("size L", "(size 10)"),
//     colors ("color: navy")
//   - rows pasted from a spreadsheet (tab-separated), in the family sheet's
//     column order: gift, description, size, color, location, other
// It skips blank lines, header rows, year lines ("2025") and exact repeats.

import { cleanLink, nameFromLink, parseLink } from "./links";

export type ParsedGift = {
  /** 0-based position among the parsed gifts; used to untick in the preview. */
  index: number;
  name: string;
  notes: string;
  size: string;
  color: string;
  price: string;
  links: string[];
  /**
   * Probably a section heading ("Clothes"), not a gift: a short line with
   * no bullet, link or details in a paste where most lines are bulleted.
   * The preview starts these unticked; the person decides.
   */
  likelyHeading: boolean;
};

export const BULK_MAX = 100;

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const BULLET_RE = /^\s*(?:[-*•·▪◦‣–—>]+|\d{1,3}[.)]|\(\d{1,3}\)|\[[ xX✓]?\]|[☐☑✔✓])\s*/;
const PRICE_RE = /(?:\b(?:under|around|about|max|up to)\s+|~|<\s*)?\$\s?\d[\d,]*(?:\.\d{1,2})?(?:\s*(?:-|to)\s*\$?\s?\d[\d,]*)?/i;
const SIZE_RE = /\(?\bsize[:\s]+([a-z0-9./\- ]{1,12}?)\)?(?=[,;)]|\s+[-–—]|\s*$)/i;
const COLOR_RE = /\(?\bcolou?r\s*:\s*([^,;()]{1,30}?)\)?(?=[,;)]|\s+[-–—]|\s*$)/i;
export const HEADER_RE = /^(gift\s*\/?\s*idea|gift|idea|item|description|size|colou?r|location|link|other|notes?|price)$/i;
const YEAR_RE = /^(?:19|20)\d{2}(?:\.0)?(?:\s*list:?)?$/i;

function trimLink(raw: string): string {
  return raw.replace(/[),.;:!?\]]+$/, "");
}

export function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:;,|·]+|[\s\-–—:;,|·]+$/g, "")
    .replace(/\(\s*\)/g, "")
    .trim();
}

/** Links found in the text (cleaned), the raw first one (for naming), and the rest. */
export function linksIn(text: string): { links: string[]; firstRaw: string; rest: string } {
  const links: string[] = [];
  let firstRaw = "";
  const rest = text.replace(URL_RE, (m) => {
    const url = trimLink(m);
    const full = url.toLowerCase().startsWith("www.") ? `https://${url}` : url;
    if (parseLink(full)) {
      if (!firstRaw) firstRaw = full;
      links.push(cleanLink(full));
    }
    return " ";
  });
  return { links, firstRaw, rest };
}

/** Pulls price, size and color phrases out of free text. */
export function details(text: string): { rest: string; price: string; size: string; color: string } {
  let rest = text;
  let price = "";
  let size = "";
  let color = "";
  const p = rest.match(PRICE_RE);
  if (p) {
    price = p[0].replace(/\s+/g, " ").trim();
    rest = rest.replace(p[0], " ");
  }
  const s = rest.match(SIZE_RE);
  if (s) {
    size = s[1].trim();
    rest = rest.replace(s[0], " ");
  }
  const c = rest.match(COLOR_RE);
  if (c) {
    color = c[1].trim();
    rest = rest.replace(c[0], " ");
  }
  return { rest, price, size, color };
}

function fromSpreadsheetRow(cells: string[]): Omit<ParsedGift, "index" | "likelyHeading"> | null {
  const links: string[] = [];
  let firstRaw = "";
  const texts = cells.map((cell) => {
    const found = linksIn(cell);
    links.push(...found.links);
    if (!firstRaw) firstRaw = found.firstRaw;
    return tidy(found.rest);
  });
  if (texts.filter(Boolean).every((t) => HEADER_RE.test(t))) return null;
  const [first = "", description = "", size = "", color = "", location = "", ...other] = texts;
  let name = first;
  const notes = [description, location, ...other].filter(Boolean);
  if (!name && notes.length > 0 && links.length === 0) name = notes.shift()!;
  const fromName = details(name);
  name = tidy(fromName.rest) || name;
  if (!name && firstRaw) name = nameFromLink(firstRaw);
  if (!name) return null;
  return {
    name,
    notes: notes.join("\n"),
    size: size || fromName.size,
    color: color || fromName.color,
    price: fromName.price,
    links: links.slice(0, 5),
  };
}

function fromLine(line: string): Omit<ParsedGift, "index" | "likelyHeading"> | null {
  const unbulleted = line.replace(BULLET_RE, "");
  const { links, firstRaw, rest } = linksIn(unbulleted);
  const d = details(rest);
  let name = tidy(d.rest);
  if (HEADER_RE.test(name) && links.length === 0) return null;
  if (!name && firstRaw) name = nameFromLink(firstRaw);
  if (!name) return null;
  return { name, notes: "", size: d.size, color: d.color, price: d.price, links: links.slice(0, 5) };
}

/** Pasted text to gifts, in the order they were pasted. */
export function parseBulk(text: string): ParsedGift[] {
  const out: ParsedGift[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !YEAR_RE.test(l.trim()));
  const bulleted = lines.filter((l) => BULLET_RE.test(l) && l.replace(BULLET_RE, "").trim()).length;
  const mostlyBulleted = bulleted >= 2 && bulleted >= lines.length / 2;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || YEAR_RE.test(line)) continue;
    const gift = raw.includes("\t") ? fromSpreadsheetRow(raw.split("\t").map((c) => c.trim())) : fromLine(line);
    if (!gift) continue;
    gift.name = gift.name.slice(0, 200);
    gift.notes = gift.notes.slice(0, 1000);
    gift.size = gift.size.slice(0, 80);
    gift.color = gift.color.slice(0, 80);
    gift.price = gift.price.slice(0, 40);
    const key = `${gift.name.toLowerCase()}|${gift.links[0] ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const likelyHeading =
      mostlyBulleted &&
      !raw.includes("\t") &&
      !BULLET_RE.test(line) &&
      gift.links.length === 0 &&
      !gift.price && !gift.size && !gift.color &&
      gift.name.split(/\s+/).length <= 4;
    out.push({ index: out.length, ...gift, likelyHeading });
    if (out.length >= BULK_MAX) break;
  }
  return out;
}
