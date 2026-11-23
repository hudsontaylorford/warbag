"use client";

import { useActionState, useState } from "react";
import type { Stop } from "@/lib/mosey/trips";
import { deleteStopAction, planStopAction, updateStopAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { StopFields } from "./StopFields";
import { dayLabel, mapsUrl } from "./format";
import { whenLabel } from "@/lib/mosey/when";

const quiet = "min-h-11 text-sm text-accent underline-offset-4 hover:underline disabled:opacity-50";

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
}: {
  stop: Stop;
  days: string[];
  canEdit: boolean;
  canPlan: boolean;
  showTime?: boolean;
  /** Already listed under the day it was suggested for. */
  hideSuggested?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [planState, planAction, planning] = useActionState(planStopAction, {});

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-3">
        {showTime && (
          <span className={`w-18 shrink-0 pt-0.5 text-sm ${stop.time || (stop.part && stop.part !== "tbd") ? "font-semibold" : "text-soft"}`}>
            {whenLabel(stop)}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {stop.link ? (
            <a href={stop.link} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold break-words text-accent underline-offset-4 hover:underline">
              {stop.title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span className="font-semibold break-words">{stop.title}</span>
          )}
          {stop.place && (
            <a href={mapsUrl(stop.place)} target="_blank" rel="noopener noreferrer" className="text-sm break-words text-soft underline-offset-4 hover:underline">
              {stop.place} · <span className="text-accent">Maps ›</span>
            </a>
          )}
          {stop.notes && <span className="text-sm break-words whitespace-pre-line">{stop.notes}</span>}
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
            onClick={() => setOpen(!open)}
            className="min-h-11 w-14 shrink-0 text-right text-sm text-accent underline-offset-4 hover:underline"
          >
            {open ? "Close" : "More"}
          </button>
        )}
      </div>

      {canPlan && !stop.day && !open && <MoveToDay stop={stop} days={days} action={planAction} pending={planning} indent={showTime} />}
      {planState.error && <Alert>{planState.error}</Alert>}

      {canEdit && open && <EditStop stop={stop} canPlan={canPlan} onDone={() => setOpen(false)} />}
    </div>
  );
}

function EditStop({ stop, canPlan, onDone }: { stop: Stop; canPlan: boolean; onDone: () => void }) {
  const [saveState, saveAction, saving] = useActionState(updateStopAction, {});
  const [moveState, moveAction, moving] = useActionState(planStopAction, {});
  const [delState, delAction, deleting] = useActionState(deleteStopAction, {});
  const [confirm, setConfirm] = useState(false);
  // Members may delete their own ideas, not stops on the plan.
  const canDelete = canPlan || !stop.day;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-control)] bg-wash p-4">
      <form action={saveAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={stop.id} />
        <Field label="What" name="title" defaultValue={stop.title} required maxLength={200} />
        <StopFields stop={stop} />
        {saveState.error && <Alert>{saveState.error}</Alert>}
        {saveState.ok && !saving && (
          <p role="status" className="text-sm text-soft">
            Saved ✓
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="quiet" onClick={onDone}>
            Close
          </Button>
        </div>
      </form>

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
