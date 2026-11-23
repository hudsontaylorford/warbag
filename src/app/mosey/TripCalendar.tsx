"use client";

import { useToday } from "./useToday";
import { shortTimeLabel } from "./format";

type DayStops = Record<string, (string | null)[]>;

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (day: string) => new Date(`${day}T00:00:00Z`);

/** "December 2026", or "December 2026 to January 2027" when the trip crosses a month. */
function monthsLabel(start: string, end: string) {
  const m = (day: string) => utc(day).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return m(start) === m(end) ? m(start) : `${m(start)} to ${m(end)}`;
}

/**
 * The whole trip at a glance: a week grid with the trip's days solid and
 * the days around them faded. Each day shows its first time and how many
 * more things are planned; tapping a day jumps to its card below.
 */
export function TripCalendar({ days, stops }: { days: string[]; stops: DayStops }) {
  const today = useToday();
  if (days.length === 0) return null;
  const first = utc(days[0]);
  const last = utc(days[days.length - 1]);
  const from = new Date(first);
  from.setUTCDate(from.getUTCDate() - from.getUTCDay());
  const to = new Date(last);
  to.setUTCDate(to.getUTCDate() + (6 - to.getUTCDay()));
  const cells: string[] = [];
  for (const d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) cells.push(iso(d));
  const inTrip = new Set(days);

  return (
    <nav aria-label="Trip days" className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{monthsLabel(days[0], days[days.length - 1])}</p>
      <div className="grid grid-cols-7 gap-1 text-center" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-xs text-soft">
            {w}
          </span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const date = utc(day).getUTCDate();
          if (!inTrip.has(day)) {
            return (
              <li key={day} aria-hidden="true" className="flex min-h-16 justify-center pt-2 text-sm text-soft/60">
                {date}
              </li>
            );
          }
          const list = stops[day] ?? [];
          const timed = list.filter((t): t is string => Boolean(t));
          const isToday = day === today;
          const label = utc(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
          const summary = list.length === 0 ? "nothing planned" : `${list.length} planned`;
          return (
            <li key={day}>
              <a
                href={`#day-${day}`}
                aria-label={`${label}${isToday ? ", today" : ""}, ${summary}`}
                className={
                  "flex h-full min-h-16 flex-col items-center gap-1 rounded-[var(--radius-control)] border px-0.5 pt-1.5 pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
                  (isToday ? "border-ink bg-ink text-page" : "border-line bg-field text-ink hover:border-ink")
                }
              >
                <span className="display text-xl leading-none">{date}</span>
                {timed[0] ? (
                  <span className={`rounded px-1 text-xs leading-4 font-semibold tabular-nums ${isToday ? "bg-page/15" : "bg-wash"}`}>{shortTimeLabel(timed[0])}</span>
                ) : (
                  list.length > 0 && (
                    <span className="flex gap-0.5 pt-1">
                      {list.slice(0, 3).map((_, k) => (
                        <span key={k} className={`size-1.5 rounded-full ${isToday ? "bg-page" : "bg-ink"}`} />
                      ))}
                    </span>
                  )
                )}
                {timed[0] && list.length > 1 && <span className={`text-xs leading-3 ${isToday ? "text-page/80" : "text-soft"}`}>+{list.length - 1}</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
