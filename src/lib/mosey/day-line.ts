import type { Stop } from "./trips";
import { STATUS_LABEL } from "@/app/mosey/format";

/** One piece of a day's line: a stop, or a set of options shown once by its title. */
export type DayLineItem = { key: string; title: string; time: string | null; flag: "Tentative" | "Inquiry sent" | "Pick one" | null };

/**
 * A day in one line: its planned stops in plan order (the order the day card
 * shows), with a short time on exact-time stops and a flag only where
 * something isn't settled: Tentative, Inquiry sent, or Pick one for a set
 * of options. Confirmed and Booked stops need no flag. Options appear once,
 * by the set's title, where the first of them falls.
 */
export function dayLine(planned: Stop[], choices: Record<string, { title: string }>): DayLineItem[] {
  const items: DayLineItem[] = [];
  const seen = new Set<string>();
  for (const s of planned) {
    const choice = s.choiceId && choices[s.choiceId] ? s.choiceId : null;
    if (choice) {
      if (seen.has(choice)) continue;
      seen.add(choice);
      items.push({ key: `c:${choice}`, title: choices[choice].title, time: s.time, flag: "Pick one" });
      continue;
    }
    const flag = s.status === "tentative" || s.status === "asked" ? STATUS_LABEL[s.status] : null;
    items.push({ key: s.id, title: s.title, time: s.time, flag });
  }
  return items;
}

/** The part of the day a stop falls in, for the headings inside a day card. */
export type DayPart = "morning" | "afternoon" | "evening" | "any";

export const DAY_PART_LABEL: Record<DayPart, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", any: "Any time" };

/**
 * Morning before noon, afternoon until 5, evening after; a typed part of the
 * day as itself; an untimed meal by its meal (breakfast, lunch, dinner);
 * "Any time" for the rest. "Time TBD" has no part: it sits where it was put.
 */
export function dayPartOf(s: Pick<Stop, "time" | "part" | "meal">): DayPart | null {
  if (s.time) {
    const h = Number(s.time.slice(0, 2));
    return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  }
  if (s.part === "tbd") return null;
  if (s.part) return s.part;
  if (s.meal === "breakfast") return "morning";
  if (s.meal === "lunch") return "afternoon";
  if (s.meal === "dinner") return "evening";
  return "any";
}

/**
 * Where headings go in a day, in the day's saved order: one before each item
 * whose part differs from the heading above it. Never re-sorts anything (a
 * hand-placed "Any time" stop keeps its place under its own heading). No
 * headings at all unless the day spans two or more parts.
 */
export function dayHeadings(parts: (DayPart | null)[]): (DayPart | null)[] {
  if (new Set(parts.filter(Boolean)).size < 2) return parts.map(() => null);
  let current: DayPart | null = null;
  return parts.map((p) => {
    if (!p || p === current) return null;
    current = p;
    return p;
  });
}
