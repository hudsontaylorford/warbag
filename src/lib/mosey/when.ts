import { parseTime } from "../time-input";

/**
 * When a stop happens: an exact time, part of a day, "time TBD", or any
 * time (nothing set). Typed in one box; safe to use in the browser too.
 */

export const PARTS = ["morning", "afternoon", "evening", "tbd"] as const;
export type Part = (typeof PARTS)[number];

export type When = { time: string | null; part: Part | null };

export type ParsedWhen = ({ ok: true; assumed: boolean } & When) | { ok: false; error: string };

const WORDS: Record<string, Part | "any"> = {
  morning: "morning",
  am: "morning",
  afternoon: "afternoon",
  evening: "evening",
  night: "evening",
  tonight: "evening",
  tbd: "tbd",
  "time tbd": "tbd",
  "to be decided": "tbd",
  any: "any",
  "any time": "any",
  anytime: "any",
  "all day": "any",
};

export function parseWhen(input: string): ParsedWhen {
  const s = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (s === "") return { ok: true, time: null, part: null, assumed: false };
  const word = WORDS[s];
  if (word) return { ok: true, time: null, part: word === "any" ? null : word, assumed: false };
  const t = parseTime(s);
  if (!t.ok) return { ok: false, error: `"${input.trim()}" isn't a time we recognize. Try 7pm, 9:30a, 14:30 or morning.` };
  return { ok: true, time: t.value, part: null, assumed: t.assumed };
}

/** "6:30 PM" from "18:30". */
export function timeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const PART_LABEL: Record<Part, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", tbd: "Time TBD" };

/** What a stop shows: "6:30 PM", "Morning", "Time TBD" or "Any time". */
export function whenLabel(w: When): string {
  if (w.time) return timeLabel(w.time);
  if (w.part) return PART_LABEL[w.part];
  return "Any time";
}

/** What goes back in the box when editing: "6:30 PM", "Morning", "TBD", or empty. */
export function whenInput(w: When): string {
  if (w.time) return timeLabel(w.time);
  if (w.part === "tbd") return "TBD";
  if (w.part) return PART_LABEL[w.part];
  return "";
}
