"use client";

import { useActionState, useId, useState } from "react";
import type { DayInfo, Stop } from "@/lib/mosey/trips";
import { setDayAction } from "./actions";
import { StopRow } from "./StopRow";
import { QuickAdd } from "./QuickAdd";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { dayLabel } from "./format";
import { useToday } from "./useToday";

type Row = { stop: Stop; canEdit: boolean };

const TAGS = ["Travel day", "Flexible", "Rest day", "Free day"];

/** Area and tag for one day: optional, quiet, organizers only. */
function DayDetails({ tripId, day, info, onDone }: { tripId: string; day: string; info: DayInfo; onDone: () => void }) {
  const list = useId();
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof setDayAction>[0], form: FormData) => {
    const next = await setDayAction(prev, form);
    if (next.ok) onDone();
    return next;
  }, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-wash p-4">
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="day" value={day} />
      <Field label="Area" name="area" maxLength={80} defaultValue={info.area} placeholder="Brooklyn → Hillsdale" hint="Optional. Where the day mostly happens." />
      <Field label="Tag" name="tag" maxLength={40} defaultValue={info.tag} list={list} placeholder="Travel day" hint="Optional." />
      <datalist id={list}>
        {TAGS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * One day of the plan as a card: the day, its area and tag, what's planned
 * in time order, ideas suggested for it, and one "Add to this day" action.
 * Days already over collapse once the trip is under way.
 */
export function DayCard({
  tripId,
  day,
  index,
  days,
  info,
  planned,
  suggested,
  canAdd,
  canPlan,
}: {
  tripId: string;
  day: string;
  index: number;
  days: string[];
  info?: DayInfo;
  planned: Row[];
  suggested: Row[];
  canAdd: boolean;
  canPlan: boolean;
}) {
  const today = useToday();
  const [openChoice, setOpen] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const isToday = day === today;
  const underway = today !== null && days[0] <= today && today <= days[days.length - 1];
  const open = openChoice ?? !(underway && day < today!);
  const bodyId = `day-body-${day}`;
  const meta = [`Day ${index + 1}`, info?.area, info?.tag].filter(Boolean).join(" · ");
  const count = planned.length;

  return (
    <section
      id={`day-${day}`}
      aria-labelledby={`day-title-${day}`}
      className={`scroll-mt-4 rounded-[calc(var(--radius-control)*2)] border bg-field ${isToday ? "border-2 border-ink" : "border-line"}`}
    >
      <h2 id={`day-title-${day}`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="flex w-full items-start gap-3 px-4 pt-4 pb-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span className="heading">{dayLabel(day)}</span>
              {isToday && <span className="rounded bg-ember px-1.5 text-xs leading-5 font-semibold text-page">Today</span>}
            </span>
            <span className="text-sm break-words text-soft">{meta}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 pt-1 text-sm text-soft">
            {!open && <span>{count === 0 ? "Nothing yet" : `${count} planned`}</span>}
            <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
              <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="flex flex-col gap-3 px-4 pb-4">
          {count > 0 ? (
            <ul className="divide-y divide-line border-t border-line">
              {planned.map(({ stop, canEdit }) => (
                <li key={stop.id}>
                  <StopRow stop={stop} days={days} canEdit={canEdit} canPlan={canPlan} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-line pt-3 text-sm text-soft">Nothing planned yet.</p>
          )}
          {suggested.length > 0 && (
            <div className="rounded-[var(--radius-control)] bg-wash px-3">
              <p className="pt-3 text-sm font-semibold">Suggested for this day</p>
              <ul className="divide-y divide-line">
                {suggested.map(({ stop, canEdit }) => (
                  <li key={stop.id}>
                    <StopRow stop={stop} days={days} canEdit={canEdit} canPlan={canPlan} hideSuggested />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {editing && <DayDetails tripId={tripId} day={day} info={info ?? { area: "", tag: "" }} onDone={() => setEditing(false)} />}
          {adding && (
            <div className="flex flex-col gap-1">
              <QuickAdd
                tripId={tripId}
                day={day}
                label={`Add to ${dayLabel(day)}`}
                placeholder={canPlan ? "What's happening?" : "Suggest something for this day"}
                autoFocus
              />
              <button type="button" onClick={() => setAdding(false)} className="min-h-11 self-start px-1 text-sm text-accent underline-offset-4 hover:underline">
                Done adding
              </button>
            </div>
          )}
          {(canAdd || canPlan) && !adding && !editing && (
            <div className="flex flex-wrap gap-x-5">
              {canAdd && (
                <button type="button" onClick={() => setAdding(true)} className="min-h-11 px-1 font-semibold text-accent underline-offset-4 hover:underline">
                  + {canPlan ? "Add to this day" : "Suggest for this day"}
                </button>
              )}
              {canPlan && (
                <button type="button" onClick={() => setEditing(true)} className="min-h-11 px-1 text-sm text-accent underline-offset-4 hover:underline">
                  {info?.area || info?.tag ? "Edit area and tag" : "Add area or tag"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
