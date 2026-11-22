"use client";

import { useActionState, useState } from "react";
import type { Stop } from "@/lib/mosey/trips";
import { deleteStopAction, planStopAction, updateStopAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { StopFields } from "./StopFields";
import { dayLabel, mapsUrl, timeLabel } from "./format";

const small =
  "min-h-11 rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent disabled:opacity-50";

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
}: {
  stop: Stop;
  days: string[];
  canEdit: boolean;
  canPlan: boolean;
  showTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [planState, planAction, planning] = useActionState(planStopAction, {});

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-3">
        {showTime && (
          <span className={`w-18 shrink-0 pt-0.5 text-sm ${stop.time ? "font-semibold" : "text-soft"}`}>
            {stop.time ? timeLabel(stop.time) : "Any time"}
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
          {(stop.membersOnly || stop.suggestedDay) && (
            <span className="text-xs text-soft">
              {[stop.suggestedDay && `Suggested for ${dayLabel(stop.suggestedDay)}`, stop.membersOnly && "Members only"].filter(Boolean).join(" · ")}
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

      {canPlan && !stop.day && !open && (
        <form action={planAction} className="flex flex-wrap items-center gap-2 pl-0 sm:pl-21">
          <input type="hidden" name="id" value={stop.id} />
          <select
            name="day"
            required
            defaultValue={stop.suggestedDay ?? ""}
            aria-label={`Day for ${stop.title}`}
            className="min-h-11 rounded-[var(--radius-control)] border border-line bg-field px-2 text-sm"
          >
            <option value="" disabled>
              Pick a day…
            </option>
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={planning} className={`${small} bg-wash text-ink hover:bg-line`}>
            {planning ? "Adding…" : "Add to plan"}
          </button>
        </form>
      )}
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
