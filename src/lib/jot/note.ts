import { InputError } from "../errors";

/**
 * Jot notes: the shapes, the cleaning every save goes through, the old
 * Stickies file format, and the light formatting notes are shown with.
 * Nothing here touches the database, so it runs in the browser and tests.
 */

export const COLOURS = ["yellow", "pink", "blue", "green", "orange", "lilac"] as const;
export type Colour = (typeof COLOURS)[number];

/** Board order of the "By importance" view, most pressing first. */
export const IMPORTANCE = ["urgent", "important", "later", "none"] as const;
export type Importance = (typeof IMPORTANCE)[number];

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  urgent: "Urgent",
  important: "Important",
  later: "Later",
  none: "No label",
};

export const COLOUR_LABEL: Record<Colour, string> = {
  yellow: "Yellow",
  pink: "Pink",
  blue: "Blue",
  green: "Green",
  orange: "Orange",
  lilac: "Lilac",
};

/**
 * How a reminder reaches you. "text" is kept for texting later (Hudson,
 * 2026-11-25): the database accepts it, but nothing offers or sends it yet.
 */
export const REMIND_BY = ["email", "none"] as const;
export type RemindBy = (typeof REMIND_BY)[number] | "text";

export const MAX_BODY = 20_000;
export const TRASH_DAYS = 30;

export type NoteFields = {
  body: string;
  colour: Colour;
  importance: Importance;
  /** ISO time, or null for no reminder. */
  remindAt: string | null;
  remindBy: RemindBy;
};

export type Note = NoteFields & {
  id: string;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
  /** When the reminder went out, or null. */
  remindedAt: string | null;
};

const isColour = (v: unknown): v is Colour => typeof v === "string" && (COLOURS as readonly string[]).includes(v);
const isImportance = (v: unknown): v is Importance => typeof v === "string" && (IMPORTANCE as readonly string[]).includes(v);

/** A time the database can hold, as ISO, or null. Throws on nonsense. */
function cleanTime(v: unknown, what: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") throw new InputError(`${what} isn't a date and time.`);
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw new InputError(`${what} isn't a date and time.`);
  const year = new Date(t).getUTCFullYear();
  if (year < 2000 || year > 2200) throw new InputError(`${what} is out of range.`);
  return new Date(t).toISOString();
}

/** What the page sends, checked and trimmed to what a note may hold. */
export function cleanFields(raw: unknown): NoteFields {
  if (!raw || typeof raw !== "object") throw new InputError("That note couldn't be read.");
  const r = raw as Record<string, unknown>;
  const body = typeof r.body === "string" ? r.body.replace(/\r\n?/g, "\n") : "";
  if (body.length > MAX_BODY) throw new InputError(`A note can be up to ${MAX_BODY.toLocaleString("en-US")} characters.`);
  return {
    body,
    colour: isColour(r.colour) ? r.colour : "yellow",
    importance: isImportance(r.importance) ? r.importance : "none",
    remindAt: cleanTime(r.remindAt, "The reminder"),
    remindBy: r.remindBy === "none" ? "none" : "email",
  };
}

// ------------------------------------------------------------ old Stickies

export type ImportedNote = NoteFields & { createdAt: string | null; trashedAt: string | null };

/** The old app's importance values over its life: true/gold, red, green, then words. */
function oldImportance(v: unknown): Importance {
  if (v === true || v === "gold" || v === "important") return "important";
  if (v === "red" || v === "urgent") return "urgent";
  if (v === "green" || v === "later") return "later";
  return "none";
}

/**
 * Notes from an old Stickies file (`notes.json` or `trash.json`): a JSON
 * array in board order. Keeps the text, colour, importance, reminder,
 * created time and (for the Trash) when it was deleted. Fonts, sizes and
 * grid cells don't carry over. Throws if the file isn't that shape.
 */
export function notesInStickiesFile(text: string): ImportedNote[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InputError("That file isn't a Stickies notes file (it isn't JSON).");
  }
  if (!Array.isArray(data)) throw new InputError("That file isn't a Stickies notes file (expected a list of notes).");
  return data.map((item, i) => {
    if (!item || typeof item !== "object" || typeof (item as { text?: unknown }).text !== "string") {
      throw new InputError(`Note ${i + 1} in the file has no text. Nothing was imported.`);
    }
    const o = item as Record<string, unknown>;
    const lenient = (v: unknown) => {
      try {
        return cleanTime(v, "time");
      } catch {
        return null;
      }
    };
    const body = String(o.text).replace(/\r\n?/g, "\n");
    if (body.length > MAX_BODY) throw new InputError(`Note ${i + 1} in the file is too long. Nothing was imported.`);
    return {
      body,
      colour: isColour(o.colour) ? o.colour : "yellow",
      importance: oldImportance(o.important),
      remindAt: lenient(o.reminder),
      // The old "Text my phone" switch: off means show on the note only.
      remindBy: o.remind_text === false ? "none" : "email",
      createdAt: lenient(o.created),
      trashedAt: lenient(o.trashed_at),
    };
  });
}

// ------------------------------------------------------------ showing a note

export type Inline = { kind: "text" | "bold" | "italic"; text: string } | { kind: "link"; text: string; href: string };

const INLINE = /\*\*([^*\n]+)\*\*|\*([^*\s][^*\n]*?)\*|(https?:\/\/[^\s<>]*[^\s<>.,;:!?'")\]])/g;

/**
 * A line of a note as plain text, **bold**, *italic* and web links, the
 * same light marks the old Stickies used. Anything else stays as typed.
 */
export function inlineParts(line: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    if (m.index > last) parts.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ kind: "bold", text: m[1] });
    else if (m[2] !== undefined) parts.push({ kind: "italic", text: m[2] });
    else parts.push({ kind: "link", text: m[3], href: m[3] });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ kind: "text", text: line.slice(last) });
  return parts;
}

/**
 * Bold or italic around the selection of a text box (Cmd/Ctrl+B or +I).
 * Selecting a marked word again takes the mark off.
 */
export function toggleMark(text: string, start: number, end: number, mark: "**" | "*"): { text: string; start: number; end: number } {
  const n = mark.length;
  const before = text.slice(start - n, start);
  const after = text.slice(end, end + n);
  // For italic, don't mistake the inside of a bold mark for an italic one.
  const marked = before === mark && after === mark && !(n === 1 && (text[start - 2] === "*" || text[end + 1] === "*"));
  if (marked) {
    return { text: text.slice(0, start - n) + text.slice(start, end) + text.slice(end + n), start: start - n, end: end - n };
  }
  return { text: text.slice(0, start) + mark + text.slice(start, end) + mark + text.slice(end), start: start + n, end: end + n };
}

/** Days left before a trashed note is deleted for good: 30 just after, 1 on the last day. */
export function daysLeft(trashedAt: string, now = Date.now()): number {
  const ms = Date.parse(trashedAt) + TRASH_DAYS * 86_400_000 - now;
  return Math.min(TRASH_DAYS, Math.max(1, Math.ceil(ms / 86_400_000)));
}
