"use client";

import type { DayInfo, Stop } from "@/lib/mosey/trips";
import { dayLine } from "@/lib/mosey/day-line";
import { shortTimeLabel } from "./format";
import { useToday } from "./useToday";

const utc = (day: string) => new Date(`${day}T00:00:00Z`);

/**
 * The whole trip at a glance, one row per day: what's planned in one line
 * (flags only where something isn't settled), the day's area and tag under
 * it. Tapping a row jumps to its day card. Replaces the month calendar
 * (Hudson, 2026-11-27, from Instinct's WRB-20261127-02): on a phone it says
 * what is happening, not just dots and times.
 */
export function DayList({
  days,
  planned,
  info,
  choices,
}: {
  days: string[];
  /** Each day's planned stops, in plan order. */
  planned: Record<string, Stop[]>;
  info: Record<string, DayInfo>;
  choices: Record<string, { title: string }>;
}) {
  const today = useToday();
  const underway = today !== null && days[0] <= today && today <= days[days.length - 1];
  return (
    <nav aria-label="Trip days">
      <ol className="flex flex-col divide-y divide-line border-y border-line">
        {days.map((day) => {
          const d = utc(day);
          const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
          const isToday = day === today;
          const past = underway && day < today!;
          const items = dayLine(planned[day] ?? [], choices);
          const meta = [info[day]?.area, info[day]?.tag].filter(Boolean).join(" · ");
          return (
            <li key={day}>
              <a
                href={`#day-${day}`}
                className={`flex min-h-12 gap-4 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${past ? "text-soft" : ""}`}
              >
                <span className="sr-only">{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}{isToday ? ", today" : ""}: </span>
                <span aria-hidden="true" className="flex w-10 shrink-0 flex-col">
                  <span className="text-xs leading-4 text-soft">{weekday}</span>
                  <span className="display text-2xl leading-7">{d.getUTCDate()}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-3 break-words">
                    {isToday && <span aria-hidden="true" className="mr-2 rounded bg-ember px-1.5 text-xs leading-5 font-semibold text-page">Today</span>}
                    {items.length === 0 ? (
                      <span className="text-soft">Nothing planned yet</span>
                    ) : (
                      items.map((it, i) => (
                        <span key={it.key}>
                          {i > 0 && <span className="text-soft"> · </span>}
                          {it.time && <span className="font-semibold tabular-nums">{shortTimeLabel(it.time)} </span>}
                          {it.title}
                          {it.flag && <span className="ml-1.5 rounded bg-wash px-1.5 align-middle text-xs leading-5 font-semibold whitespace-nowrap text-ink">{it.flag}</span>}
                        </span>
                      ))
                    )}
                  </span>
                  {meta && <span className="text-sm break-words text-soft">{meta}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
