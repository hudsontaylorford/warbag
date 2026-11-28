"use client";

import { useActionState, useState } from "react";
import type { Stop } from "@/lib/mosey/trips";
import { Notes } from "@/components/ui/Notes";
import { deleteStopAction, planStopAction, setStopChoiceAction, updateStopAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { SaveStatus, useAutosave } from "@/components/ui/forms";
import { StopFields } from "./StopFields";
import { useEditor } from "./editing";
import { dayLabel, mapsUrl, MEAL_LABEL, STATUS_LABEL } from "./format";
import { Attendance } from "./Attendance";
import { whenLabel } from "@/lib/mosey/when";

const quiet = "min-h-11 text-sm text-button disabled:opacity-50";

/** "Thu 17": short enough for a row of day buttons on a phone. */
const chipLabel = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  return `${d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${d.getUTCDate()}`;
};

/**
 * Putting an idea on the plan (organizers): a quiet "Move to a day", which
 * opens the trip's days as buttons; one tap plans it. An idea suggested for
 * a day gets that day as a one-tap shortcut.
 */
function MoveToDay({
  stop,
  days,
  action,
  pending,
  indent,
}: {
  stop: Stop;
  days: string[];
  action: (form: FormData) => void;
  pending: boolean;
  indent: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const pad = indent ? "sm:pl-21" : "";
  if (!picking) {
    return (
      <form action={action} className={`-mt-4 flex flex-wrap items-center gap-x-5 ${pad}`}>
        <input type="hidden" name="id" value={stop.id} />
        {stop.suggestedDay && (
          <button type="submit" name="day" value={stop.suggestedDay} disabled={pending} className={`${quiet} font-semibold`}>
            {pending ? "Adding…" : `Add to ${dayLabel(stop.suggestedDay)}`}
          </button>
        )}
        <button type="button" onClick={() => setPicking(true)} aria-label={`Move ${stop.title} to a day`} className={quiet}>
          {stop.suggestedDay ? "Other day" : "Move to a day"}
        </button>
      </form>
    );
  }
  return (
    <form action={action} className={`flex flex-col gap-1 ${pad}`}>
      <input type="hidden" name="id" value={stop.id} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Move {stop.title} to</legend>
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => (
            <button
              key={d}
              type="submit"
              name="day"
              value={d}
              disabled={pending}
              aria-label={dayLabel(d)}
              className={`min-h-11 min-w-14 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
                d === stop.suggestedDay ? "border-ink font-semibold" : "border-line"
              } bg-field text-ink hover:border-ink`}
            >
              {chipLabel(d)}
            </button>
          ))}
        </div>
      </fieldset>
      <button type="button" onClick={() => setPicking(false)} className={`${quiet} self-start`}>
        {pending ? "Moving…" : "Cancel"}
      </button>
    </form>
  );
}

/**
 * One stop or idea: time, title (opens its link), place with Open in Maps,
 * notes. More opens editing for organizers and for the member who added it.
 * Organizers also get one tap to put an idea on a day, or take it off.
 */
export function StopRow({
  stop,
  days,
  canEdit,
  canPlan,
  showTime = true,
  hideSuggested = false,
  attend,
  choicesHere,
  brief = false,
  under,
}: {
  stop: Stop;
  days: string[];
  canEdit: boolean;
  canPlan: boolean;
  showTime?: boolean;
  /** Already listed under the day it was suggested for. */
  hideSuggested?: boolean;
  /** Members only: the trip's people and who's marked for this stop. */
  attend?: { tripId: string; people: { id: string; name: string; me: boolean }[]; marks: { personId: string; state: "going" | "maybe" }[]; organizer: boolean };
  /** Choices on this stop's day, for "Part of options" in More (organizers). */
  choicesHere?: { id: string; title: string }[];
  /** On the Plan's day cards: notes fold to one line, so the day reads as a plan. */
  brief?: boolean;
  /** The heading this row sits under in a day card ("Morning", "Any time"): the row doesn't repeat it. */
  under?: string;
}) {
  const editor = useEditor(`stop:${stop.id}`);
  const open = editor.open;
  const [justSaved, setJustSaved] = useState(false);
  const [planState, planAction, planning] = useActionState(planStopAction, {});
  // A meal with no time shows "Dinner" where the time goes.
  const mealInTime = Boolean(stop.meal && stop.meal !== "food" && !stop.time && !stop.part);

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-3">
        {showTime && (
          <span
            className={`w-18 shrink-0 pt-0.5 text-sm ${stop.time || (stop.part && stop.part !== "tbd") || mealInTime ? "font-semibold" : "text-soft"}`}
          >
            {(() => {
              const label = mealInTime ? MEAL_LABEL[stop.meal!] : whenLabel(stop);
              return label === under ? "" : label;
            })()}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-baseline gap-x-2">
            {stop.link ? (
              <a href={stop.link} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold break-words text-accent underline-offset-4 hover:underline">
                {stop.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span className="font-semibold break-words">{stop.title}</span>
            )}
            {stop.meal && !(showTime && mealInTime) && <span className="text-xs leading-5 text-soft">{MEAL_LABEL[stop.meal]}</span>}
            {stop.status && (
              <span
                className={`rounded px-1.5 text-xs leading-5 font-semibold ${
                  stop.status === "booked" || stop.status === "confirmed" ? "bg-ink text-page" : "border border-line text-soft"
                }`}
              >
                {STATUS_LABEL[stop.status]}
              </span>
            )}
          </div>
          {stop.place && (
            <a href={mapsUrl(stop.place)} target="_blank" rel="noopener noreferrer" className="-my-2 self-start py-3 text-sm break-words text-soft underline-offset-4 hover:underline">
              {stop.place} · <span className="text-accent">Maps ›</span>
            </a>
          )}
          {stop.handledBy && <span className="text-sm break-words">Handling it: {stop.handledBy}</span>}
          {stop.notes && <Notes text={stop.notes} fold={brief ? 1 : 3} />}
          {(stop.membersOnly || (stop.suggestedDay && !hideSuggested)) && (
            <span className="text-xs text-soft">
              {[stop.suggestedDay && !hideSuggested && `Suggested for ${dayLabel(stop.suggestedDay)}`, stop.membersOnly && "Members only"].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              if (open) editor.closeIfClean();
              else {
                setJustSaved(false);
                editor.request();
              }
            }}
            aria-label={open ? undefined : `More about ${stop.title}`}
            className="flex min-h-11 w-14 shrink-0 items-start justify-end pt-0.5 text-sm text-button"
          >
            {open ? "Close" : "More"}
          </button>
        )}
      </div>

      {canPlan && !stop.day && !open && <MoveToDay stop={stop} days={days} action={planAction} pending={planning} indent={showTime} />}
      {planState.error && <Alert>{planState.error}</Alert>}
      {attend && stop.askWho && !open && <Attendance tripId={attend.tripId} stopId={stop.id} people={attend.people} marks={attend.marks} organizer={attend.organizer} indent={showTime} />}

      {justSaved && !open && (
        <p role="status" className={`-mt-2 text-sm text-soft ${showTime ? "sm:pl-21" : ""}`}>
          Saved ✓
        </p>
      )}
      {canEdit && open && (
        <EditStop
          stop={stop}
          canPlan={canPlan}
          choicesHere={choicesHere ?? []}
          nudged={editor.nudged}
          onDirty={editor.setDirty}
          onSaved={() => {
            editor.close();
            setJustSaved(true);
          }}
          onDone={editor.close}
        />
      )}
    </div>
  );
}

/** Organizers: make a stop one of a day's options, or take it out. */
function PartOfOptions({ stop, choicesHere }: { stop: Stop; choicesHere: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(setStopChoiceAction, {});
  const { ref: autoRef, saveSoon: autoSaveSoon } = useAutosave(0);
  return (
    <form ref={autoRef} action={action} onChange={() => autoSaveSoon()} className="flex flex-col gap-2 border-t border-line pt-4">
      <input type="hidden" name="id" value={stop.id} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Part of options</span>
        <select
          name="choice"
          defaultValue={stop.choiceId ?? ""}
          className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <option value="">Not part of options</option>
          {choicesHere.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <span className="text-sm text-soft">To start new options, use &quot;+ Add options&quot; on the day.</span>
      </label>
      <SaveStatus state={state} pending={pending} />
    </form>
  );
}

function EditStop({
  stop,
  canPlan,
  choicesHere,
  nudged,
  onDirty,
  onSaved,
  onDone,
}: {
  stop: Stop;
  canPlan: boolean;
  choicesHere: { id: string; title: string }[];
  nudged: boolean;
  onDirty: (dirty: boolean) => void;
  onSaved: () => void;
  onDone: () => void;
}) {
  // Save closes the editor; the row then says "Saved ✓".
  const [saveState, saveAction, saving] = useActionState(async (prev: Parameters<typeof updateStopAction>[0], form: FormData) => {
    const next = await updateStopAction(prev, form);
    if (next.ok) onSaved();
    return next;
  }, {});
  const [moveState, moveAction, moving] = useActionState(planStopAction, {});
  const [delState, delAction, deleting] = useActionState(deleteStopAction, {});
  const [confirm, setConfirm] = useState(false);
  // Members may delete their own ideas, not stops on the plan.
  const canDelete = canPlan || !stop.day;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-control)] border-2 border-ink bg-wash p-4">
      <form action={saveAction} aria-label={`Editing: ${stop.title}`} onChange={() => onDirty(true)} className="flex flex-col gap-3">
        <p className="text-sm font-semibold">
          Editing: <span className="break-words">{stop.title}</span>
        </p>
        {nudged && <Alert>Save or cancel these changes first.</Alert>}
        <input type="hidden" name="id" value={stop.id} />
        <Field label="What" name="title" defaultValue={stop.title} required maxLength={200} />
        <StopFields stop={stop} />
        {saveState.error && <Alert>{saveState.error}</Alert>}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="quiet" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>

      {canPlan && stop.day && (stop.choiceId || choicesHere.length > 0) && <PartOfOptions stop={stop} choicesHere={choicesHere} />}
      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
        {canPlan && stop.day && (
          <form action={moveAction} className="flex-1">
            <input type="hidden" name="id" value={stop.id} />
            <Button type="submit" variant="quiet" disabled={moving}>
              {moving ? "Moving…" : "Move to Ideas"}
            </Button>
          </form>
        )}
        {canDelete &&
          (!confirm ? (
            <div className="flex-1">
              <Button variant="quiet" onClick={() => setConfirm(true)}>
                Delete
              </Button>
            </div>
          ) : (
            <form action={delAction} className="flex w-full flex-col gap-3">
              <input type="hidden" name="id" value={stop.id} />
              <p className="text-sm">Delete {stop.title}? This can&apos;t be undone.</p>
              <div className="flex gap-3">
                <Button type="submit" variant="danger" disabled={deleting}>
                  {deleting ? "Deleting…" : "Yes, delete"}
                </Button>
                <Button variant="quiet" onClick={() => setConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ))}
      </div>
      {moveState.error && <Alert>{moveState.error}</Alert>}
      {delState.error && <Alert>{delState.error}</Alert>}
    </div>
  );
}
