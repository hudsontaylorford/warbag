import Link from "next/link";
import type { Stop, TripDetail } from "@/lib/mosey/trips";
import { StopRow } from "./StopRow";
import { QuickAdd } from "./QuickAdd";
import { rangeLabel } from "./format";
import { DayCard } from "./DayCard";
import { TripCalendar } from "./TripCalendar";

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
 * The plan: a calendar of the trip, then one card per day with stops in
 * time order (any time last) and ideas suggested for that day.
 */
export function DayCards({ trip, canAdd, canPlan, viewerOnly }: { trip: TripDetail; canAdd: boolean; canPlan: boolean; viewerOnly?: boolean }) {
  const editable = (s: Stop) => !viewerOnly && (canPlan || s.mine);
  const plan = canPlan && !viewerOnly;
  const byDay = Object.fromEntries(trip.days.map((d) => [d, trip.stops.filter((s) => s.day === d).map((s) => s.time)]));
  return (
    <div className="flex flex-col gap-6">
      {trip.days.length > 1 && <TripCalendar days={trip.days} stops={byDay} />}
      <div className="flex flex-col gap-4">
        {trip.days.map((day, i) => (
          <DayCard
            key={day}
            tripId={trip.id}
            day={day}
            index={i}
            days={trip.days}
            info={trip.dayInfo[day]}
            planned={trip.stops.filter((s) => s.day === day).map((stop) => ({ stop, canEdit: editable(stop) }))}
            suggested={trip.stops.filter((s) => !s.day && s.suggestedDay === day).map((stop) => ({ stop, canEdit: editable(stop) }))}
            canAdd={canAdd && !viewerOnly}
            canPlan={plan}
            attend={attendFor(trip, viewerOnly)}
          />
        ))}
      </div>
    </div>
  );
}

/** Who's going, for members only: never for viewers or view links. */
function attendFor(trip: TripDetail, viewerOnly?: boolean) {
  if (viewerOnly || !trip.people || !trip.attendance) return undefined;
  return { tripId: trip.id, people: trip.people, marks: trip.attendance, organizer: trip.organizer };
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
              <StopRow
                stop={s}
                days={trip.days}
                canEdit={!viewerOnly && (canPlan || s.mine)}
                canPlan={canPlan && !viewerOnly}
                showTime={false}
                attend={(() => {
                  const a = attendFor(trip, viewerOnly);
                  return a && { ...a, marks: a.marks[s.id] ?? [] };
                })()}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-soft">No ideas yet. Anything goes: places to check out, food, things to bring.</p>
      )}
    </div>
  );
}
