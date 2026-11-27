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
