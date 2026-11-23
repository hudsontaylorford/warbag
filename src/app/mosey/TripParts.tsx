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
            choices={trip.choices}
          />
        ))}
      </div>
    </div>
  );
}

/** Who's going, for members only: never for viewers or view links. */
function attendFor(trip: TripDetail, viewerOnly?: boolean) {
  // Nothing to mark until the trip has people (added on Money).
  if (viewerOnly || !trip.people?.length || !trip.attendance) return undefined;
  return { tripId: trip.id, people: trip.people, marks: trip.attendance, organizer: trip.organizer };
}

/** Ideas: everything not on a day yet. */
export function IdeaList({
  trip,
  canAdd,
  canPlan,
  viewerOnly,
  food,
  base,
}: {
  trip: TripDetail;
  canAdd: boolean;
  canPlan: boolean;
  viewerOnly?: boolean;
  /** Show only food and drink ideas. */
  food?: boolean;
  /** Where the Ideas page lives, for the All / Food & drink links. */
  base?: string;
}) {
  const all = trip.stops.filter((s) => !s.day);
  const meals = all.filter((s) => s.meal);
  const ideas = food ? meals : all;
  const filter = (on: boolean, label: string, href: string) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${on ? "border-ink bg-ink text-page" : "border-line bg-field text-ink"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4">
      {canAdd && <QuickAdd tripId={trip.id} label="Add an idea" placeholder="A place, a restaurant, something to bring…" trackDetails />}
      {base && (meals.length > 0 || food) && (
        <nav aria-label="Show" className="flex gap-2">
          {filter(!food, `All (${all.length})`, base)}
          {filter(Boolean(food), `Food & drink (${meals.length})`, `${base}?show=food`)}
        </nav>
      )}
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
        <p className="text-soft">{food ? "No food or drink ideas." : "No ideas yet. Anything goes: places to check out, food, things to bring."}</p>
      )}
    </div>
  );
}
