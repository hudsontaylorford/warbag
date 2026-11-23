"use client";

import { useActionState, useState } from "react";
import type { Stop } from "@/lib/mosey/trips";
import { createChoiceAction, setAttendanceAction, ungroupChoiceAction } from "./actions";
import { StopRow } from "./StopRow";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { WhenField } from "./WhenField";
import { whenLabel } from "@/lib/mosey/when";

type Person = { id: string; name: string; me: boolean };
type Mark = { personId: string; state: "going" | "maybe" };
type Row = { stop: Stop; canEdit: boolean };
type Attend = { tripId: string; people: Person[]; marks: Record<string, Mark[]>; organizer: boolean };

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
    on ? "border-ink bg-ink text-page" : "border-line bg-field text-ink"
  }`;

/** Picks one option for one person; tapping their current pick clears it. */
function Pick({ stopId, personId, on, label, aria }: { stopId: string; personId: string; on: boolean; label: string; aria?: string }) {
  const [state, action, pending] = useActionState(setAttendanceAction, {});
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={stopId} />
      <input type="hidden" name="person" value={personId} />
      <button type="submit" name="state" value={on ? "" : "going"} disabled={pending} aria-pressed={on} aria-label={aria} className={chip(on)}>
        {label}
      </button>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

/**
 * Competing options on a day ("Monday afternoon: ski, hike or spa") as one
 * block. Each person picks one; the block shows who picked what. Organizers
 * can set anyone's pick and ungroup the options.
 */
export function OptionsBlock({
  choiceId,
  title,
  rows,
  days,
  canPlan,
  attend,
  choicesHere,
}: {
  choiceId: string;
  title: string;
  rows: Row[];
  days: string[];
  canPlan: boolean;
  attend?: Attend;
  choicesHere: { id: string; title: string }[];
}) {
  const [table, setTable] = useState(false);
  const [ungroupState, ungroup, ungrouping] = useActionState(ungroupChoiceAction, {});
  const name = new Map((attend?.people ?? []).map((p) => [p.id, p.name]));
  const me = attend?.people.find((p) => p.me);
  const pickOf = new Map<string, string>(); // person -> option stop id
  for (const { stop } of rows) for (const m of attend?.marks[stop.id] ?? []) if (m.state === "going") pickOf.set(m.personId, stop.id);
  const undecided = (attend?.people ?? []).filter((p) => !pickOf.has(p.id));
  // Options that all share one time show it once, in the header; otherwise
  // each option shows its own (and nothing when none has one).
  const first = rows[0]?.stop;
  const shared = rows.every(({ stop }) => stop.time === first?.time && stop.part === first?.part);
  const sharedLabel = shared && first && (first.time || first.part) ? whenLabel(first) : null;
  const timed = !shared && rows.some(({ stop }) => stop.time || stop.part);

  return (
    <div className="my-2 flex flex-col rounded-[var(--radius-control)] border border-line bg-wash px-3 pt-3 pb-2">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold break-words">{title}</span>
        <span className="text-sm text-soft">{[sharedLabel, "Options · pick one"].filter(Boolean).join(" · ")}</span>
      </p>
      <ul className="divide-y divide-line">
        {rows.map(({ stop, canEdit }) => {
          const picked = (attend?.marks[stop.id] ?? []).filter((m) => m.state === "going").map((m) => name.get(m.personId) ?? "");
          return (
            <li key={stop.id} className="flex flex-col">
              <StopRow stop={stop} days={days} canEdit={canEdit} canPlan={canPlan} choicesHere={choicesHere} showTime={timed} />
              {attend && (
                <div className={`-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 pb-3 text-sm ${timed ? "sm:pl-21" : ""}`}>
                  <span className="break-words text-soft">{picked.length ? picked.join(", ") : "No picks yet"}</span>
                  {me && <Pick stopId={stop.id} personId={me.id} on={pickOf.get(me.id) === stop.id} label={pickOf.get(me.id) === stop.id ? "Your pick" : "Pick this"} aria={`Pick ${stop.title}`} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {attend && (
        <div className="flex flex-wrap items-center gap-x-5 border-t border-line pt-1 text-sm">
          <button type="button" aria-expanded={table} onClick={() => setTable(!table)} className="min-h-11 text-accent underline-offset-4 hover:underline">
            {table ? "Done" : undecided.length && attend.people.length ? `Who picked what (${undecided.length} not yet)` : "Who picked what"}
          </button>
          {canPlan && !table && (
            <form action={ungroup}>
              <input type="hidden" name="id" value={attend.tripId} />
              <input type="hidden" name="choice" value={choiceId} />
              <button type="submit" disabled={ungrouping} className="min-h-11 text-accent underline-offset-4 hover:underline disabled:opacity-50">
                {ungrouping ? "Ungrouping…" : "Ungroup"}
              </button>
            </form>
          )}
        </div>
      )}
      {ungroupState.error && <Alert>{ungroupState.error}</Alert>}
      {attend && table && (
        <ul className="flex flex-col divide-y divide-line pb-2">
          {attend.people.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 py-2">
              <span className="text-sm">
                {p.name}
                {p.me && <span className="text-soft"> (you)</span>}
              </span>
              {attend.organizer || p.me ? (
                <div className="flex flex-wrap gap-1" role="group" aria-label={`${p.name}: pick`}>
                  {rows.map(({ stop }) => (
                    <Pick key={stop.id} stopId={stop.id} personId={p.id} on={pickOf.get(p.id) === stop.id} label={stop.title} />
                  ))}
                </div>
              ) : (
                <span className="text-sm text-soft">{rows.find((r) => r.stop.id === pickOf.get(p.id))?.stop.title ?? "Not yet"}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Organizers: add a choice to a day, with two or more options. */
export function AddOptions({ tripId, day, onDone }: { tripId: string; day: string; onDone: () => void }) {
  const [count, setCount] = useState(3);
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof createChoiceAction>[0], form: FormData) => {
    const next = await createChoiceAction(prev, form);
    if (next.ok) onDone();
    return next;
  }, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-wash p-4">
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="day" value={day} />
      <Field label="What's being decided" name="title" required maxLength={80} placeholder="Monday afternoon" autoFocus />
      <WhenField />
      {Array.from({ length: count }, (_, i) => (
        <Field key={i} label={`Option ${i + 1}`} name="option" maxLength={200} placeholder={["Ski day", "Hike", "Spa"][i] ?? ""} required={i < 2} />
      ))}
      {count < 8 && (
        <button type="button" onClick={() => setCount(count + 1)} className="min-h-11 self-start text-sm text-accent underline-offset-4 hover:underline">
          + Another option
        </button>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add options"}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
