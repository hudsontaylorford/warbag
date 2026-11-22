import Link from "next/link";
import type { Stop, TripDetail } from "@/lib/mosey/trips";
import { StopRow } from "./StopRow";
import { QuickAdd } from "./QuickAdd";
import { dayLabel, rangeLabel } from "./format";

/** Trip name, dates and place, with Plan / Ideas. */
export function TripHeader({ trip, base, current, back, money }: { trip: TripDetail; base: string; current: "plan" | "ideas" | "money"; back?: boolean; money?: boolean }) {
  const ideas = trip.stops.filter((s) => !s.day).length;
  const tab = (id: "plan" | "ideas" | "money", label: string, href: string) => (
    <Link
      href={href}
      aria-current={current === id ? "page" : undefined}
      className={
        "-mb-px flex min-h-12 items-center border-b-2 px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
        (current === id ? "border-ink text-ink" : "border-transparent text-soft hover:text-ink")
      }
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4">
      <div>
        {back && (
          <Link href="/mosey" className="text-accent underline-offset-4 hover:underline">
            ‹ Trips
          </Link>
        )}
        <p className="mt-2 text-sm font-semibold text-soft">{[rangeLabel(trip.startDate, trip.endDate), trip.place].filter(Boolean).join(" · ")}</p>
        <h1 className="title break-words">{trip.name}</h1>
      </div>
      <nav aria-label="Trip" className="-mx-1 flex gap-1 border-b border-line">
        {tab("plan", "Plan", base)}
        {tab("ideas", ideas ? `Ideas (${ideas})` : "Ideas", `${base}/ideas`)}
        {money && tab("money", "Money", `${base}/money`)}
      </nav>
    </div>
  );
}

/**
 * The plan: one card per day, stops in time order (any-time last), and
 * ideas someone suggested for that day underneath for an organizer.
 */
export function DayCards({ trip, canAdd, canPlan, viewerOnly }: { trip: TripDetail; canAdd: boolean; canPlan: boolean; viewerOnly?: boolean }) {
  const editable = (s: Stop) => !viewerOnly && (canPlan || s.mine);
  return (
    <ol className="flex flex-col gap-6">
      {trip.days.map((day, i) => {
        const planned = trip.stops.filter((s) => s.day === day);
        const suggested = trip.stops.filter((s) => !s.day && s.suggestedDay === day);
        return (
          <li key={day} className="flex flex-col gap-2 border-t-2 border-ink pt-3">
            <h2 className="flex items-baseline justify-between gap-3">
              <span className="heading">{dayLabel(day)}</span>
              <span className="text-sm text-soft">Day {i + 1}</span>
            </h2>
            {planned.length > 0 ? (
              <ul className="divide-y divide-line">
                {planned.map((s) => (
                  <li key={s.id}>
                    <StopRow stop={s} days={trip.days} canEdit={editable(s)} canPlan={canPlan && !viewerOnly} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-soft">Nothing planned yet.</p>
            )}
            {suggested.length > 0 && (
              <div className="rounded-[var(--radius-control)] bg-wash px-3">
                <p className="pt-3 text-sm font-semibold">Suggested for this day</p>
                <ul className="divide-y divide-line">
                  {suggested.map((s) => (
                    <li key={s.id}>
                      <StopRow stop={{ ...s, suggestedDay: null }} days={trip.days} canEdit={editable(s)} canPlan={canPlan && !viewerOnly} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {canAdd && (
              <QuickAdd
                tripId={trip.id}
                day={day}
                label={`Add to ${dayLabel(day)}`}
                placeholder={canPlan ? "Add to this day" : "Suggest something for this day"}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Ideas: everything not on a day yet. */
export function IdeaList({ trip, canAdd, canPlan, viewerOnly }: { trip: TripDetail; canAdd: boolean; canPlan: boolean; viewerOnly?: boolean }) {
  const ideas = trip.stops.filter((s) => !s.day);
  return (
    <div className="flex flex-col gap-4">
      {canAdd && <QuickAdd tripId={trip.id} label="Add an idea" placeholder="A place, a restaurant, something to bring…" />}
      {ideas.length > 0 ? (
        <ul className="divide-y divide-line border-y border-line">
          {ideas.map((s) => (
            <li key={s.id}>
              <StopRow stop={s} days={trip.days} canEdit={!viewerOnly && (canPlan || s.mine)} canPlan={canPlan && !viewerOnly} showTime={false} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-soft">No ideas yet. Anything goes: places to check out, food, things to bring.</p>
      )}
    </div>
  );
}
