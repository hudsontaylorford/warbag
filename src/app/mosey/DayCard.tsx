"use client";

import { Fragment, useActionState, useId, useState } from "react";
import type { DayInfo, Stop } from "@/lib/mosey/trips";
import { setDayAction } from "./actions";
import { StopRow } from "./StopRow";
import { QuickAdd } from "./QuickAdd";
import { AddOptions, OptionsBlock } from "./Options";
import { Reorder } from "./Reorder";
import { useEditor } from "./editing";
import { Field } from "@/components/ui/Field";
import { SaveStatus, useAutosave } from "@/components/ui/forms";
import { dayLabel } from "./format";
import { useToday } from "./useToday";
import { DAY_PART_LABEL, dayHeadings, dayPartOf } from "@/lib/mosey/day-line";

type Row = { stop: Stop; canEdit: boolean };

const TAGS = ["Travel day", "Flexible", "Rest day", "Free day"];

/** Area, tag and where people stay for one day: optional, quiet, organizers only. */
function DayDetails({ tripId, day, info, onDone }: { tripId: string; day: string; info: DayInfo; onDone: () => void }) {
  const list = useId();
  // Saves itself when you leave a field; Done closes it.
  const [state, action, pending] = useActionState(setDayAction, {});
  const { ref: autoRef, saveNow: autoSaveNow } = useAutosave();
  return (
    <form
      ref={autoRef}
      action={action}
      onBlur={(e) => (e.target instanceof HTMLInputElement ? autoSaveNow() : undefined)}
      className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-wash p-4"
    >
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="day" value={day} />
      <Field label="Area" name="area" maxLength={80} defaultValue={info.area} placeholder="Brooklyn → Hillsdale" hint="Optional. Where the day mostly happens." />
      <Field label="Tag" name="tag" maxLength={40} defaultValue={info.tag} list={list} placeholder="Travel day" hint="Optional." />
      <datalist id={list}>
        {TAGS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Field
        label="Staying"
        name="staying"
        maxLength={120}
        defaultValue={info.staying}
        placeholder="Lake house, details pending"
        hint="Optional. Where people sleep that night. Shown when it changes; members only."
      />
      <SaveStatus state={state} pending={pending} />
      <button type="button" onClick={onDone} disabled={pending} className="min-h-11 self-start font-semibold text-button disabled:opacity-50">
        Done
      </button>
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
  attend,
  choices = {},
  staying,
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
  /** Members only: the trip's people and who's going to what. */
  attend?: { tripId: string; people: { id: string; name: string; me: boolean }[]; marks: Record<string, { personId: string; state: "going" | "maybe" }[]>; organizer: boolean };
  /** The trip's choices between options, by id. */
  choices?: Record<string, { title: string }>;
  /** Where people stay tonight, when it changed from last night (members only). */
  staying?: string;
}) {
  const today = useToday();
  const [openChoice, setOpen] = useState<boolean | null>(null);
  // The add box is an editor too: one open on the page at a time.
  const addBox = useEditor(`add:${day}`);
  const adding = addBox.open;
  const setAdding = (on: boolean) => (on ? addBox.request() : addBox.close());
  const [editing, setEditing] = useState(false);
  const [addingOptions, setAddingOptions] = useState(false);
  const [reordering, setReordering] = useState(false);
  // The day's less common tools stay folded so "Add to this day" stands alone.
  const [tools, setTools] = useState(false);
  // Options of one choice show together, where the first of them falls in the day.
  const choicesHere = [...new Set(planned.map((r) => r.stop.choiceId).filter((c): c is string => Boolean(c && choices[c])))].map((id) => ({ id, title: choices[id].title }));
  const items: ({ kind: "stop"; row: Row } | { kind: "options"; id: string; rows: Row[] })[] = [];
  for (const row of planned) {
    const c = row.stop.choiceId && choices[row.stop.choiceId] ? row.stop.choiceId : null;
    if (!c) items.push({ kind: "stop", row });
    else if (!items.some((it) => it.kind === "options" && it.id === c)) items.push({ kind: "options", id: c, rows: planned.filter((r) => r.stop.choiceId === c) });
  }
  // Morning / Afternoon / Evening / Any time headings where the part of the day changes, in saved order.
  const headings = dayHeadings(items.map((it) => dayPartOf(it.kind === "stop" ? it.row.stop : it.rows[0].stop)));
  const underAt: (string | undefined)[] = [];
  headings.reduce<string | undefined>((cur, h, i) => (underAt[i] = h ? DAY_PART_LABEL[h] : cur), undefined);
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
            {staying && <span className="text-sm break-words text-soft">Staying: {staying}</span>}
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
          {reordering ? (
            <Reorder stops={planned.map((r) => r.stop)} onDone={() => setReordering(false)} />
          ) : count > 0 ? (
            <ul className="divide-y divide-line border-t border-line">
              {items.map((it, i) => {
                const heading = headings[i];
                const row =
                  it.kind === "stop" ? (
                    <li key={it.row.stop.id}>
                      <StopRow
                        stop={it.row.stop}
                        days={days}
                        canEdit={it.row.canEdit}
                        canPlan={canPlan}
                        choicesHere={choicesHere}
                        attend={attend && { ...attend, marks: attend.marks[it.row.stop.id] ?? [] }}
                        brief
                        under={underAt[i]}
                      />
                    </li>
                  ) : (
                    <li key={it.id}>
                      <OptionsBlock choiceId={it.id} title={choices[it.id].title} rows={it.rows} days={days} canPlan={canPlan} attend={attend} choicesHere={choicesHere} />
                    </li>
                  );
                return heading ? (
                  <Fragment key={`h:${heading}:${i}`}>
                    <li className="!border-b-0 pt-3 -mb-1.5">
                      <h3 className="text-sm font-semibold text-soft">{DAY_PART_LABEL[heading]}</h3>
                    </li>
                    {row}
                  </Fragment>
                ) : (
                  row
                );
              })}
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
                    <StopRow stop={stop} days={days} canEdit={canEdit} canPlan={canPlan} hideSuggested brief attend={attend && { ...attend, marks: attend.marks[stop.id] ?? [] }} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {editing && <DayDetails tripId={tripId} day={day} info={info ?? { area: "", tag: "", staying: "" }} onDone={() => setEditing(false)} />}
          {adding && (
            <div className="flex flex-col gap-1">
              <QuickAdd
                tripId={tripId}
                day={day}
                label={`Add to ${dayLabel(day)}`}
                placeholder={canPlan ? "What's happening?" : "Suggest something for this day"}
                autoFocus
              />
              <button type="button" onClick={() => setAdding(false)} className="min-h-11 self-start px-1 text-sm text-button">
                Done adding
              </button>
            </div>
          )}
          {addingOptions && <AddOptions tripId={tripId} day={day} onDone={() => setAddingOptions(false)} />}
          {(canAdd || canPlan) && !adding && !editing && !addingOptions && !reordering && (
            <div className="flex flex-wrap gap-x-5">
              {canAdd && (
                <button type="button" onClick={() => setAdding(true)} className="min-h-11 px-1 font-semibold text-button">
                  + {canPlan ? "Add to this day" : "Suggest for this day"}
                </button>
              )}
              {canPlan && (
                <button type="button" aria-expanded={tools} onClick={() => setTools(!tools)} className="min-h-11 px-1 text-sm text-button">
                  {tools ? "Fewer" : "More for this day"}
                </button>
              )}
              {canPlan && tools && (
                <span className="flex basis-full flex-wrap gap-x-5">
                  {count > 1 && (
                    <button type="button" onClick={() => setReordering(true)} className="min-h-11 px-1 text-sm text-button">
                      Reorder
                    </button>
                  )}
                  <button type="button" onClick={() => setAddingOptions(true)} className="min-h-11 px-1 text-sm text-button">
                    + Add options
                  </button>
                  <button type="button" onClick={() => setEditing(true)} className="min-h-11 px-1 text-sm text-button">
                    {info?.area || info?.tag || info?.staying ? "Edit area, tag and staying" : "Add area, tag or staying"}
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
