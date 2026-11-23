"use client";

import { useActionState } from "react";
import type { Stop } from "@/lib/mosey/trips";
import { moveStopAction } from "./actions";
import { Alert } from "@/components/ui/Alert";
import { whenLabel } from "@/lib/mosey/when";

const arrow = "flex size-11 items-center justify-center rounded-full border border-line bg-field text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-30";

function Row({ stop, first, last }: { stop: Stop; first: boolean; last: boolean }) {
  const [state, action, pending] = useActionState(moveStopAction, {});
  return (
    <li className="flex flex-col gap-1 py-2">
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="id" value={stop.id} />
        <span className="w-18 shrink-0 text-sm text-soft">{whenLabel(stop)}</span>
        <span className="min-w-0 flex-1 font-semibold break-words">{stop.title}</span>
        <button type="submit" name="direction" value="up" disabled={first || pending} aria-label={`Move ${stop.title} up`} className={arrow}>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
            <path d="M5 12l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="submit" name="direction" value="down" disabled={last || pending} aria-label={`Move ${stop.title} down`} className={arrow}>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
            <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
      {state.error && <Alert>{state.error}</Alert>}
    </li>
  );
}

/**
 * Organizers: put a day's stops in order. Times still set the order; stops
 * with no time (Any time, Time TBD) can go anywhere. Tap or keyboard, no drag.
 */
export function Reorder({ stops, onDone }: { stops: Stop[]; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-2">
      <p className="text-sm text-soft">Times set the order. Stops without a time can go anywhere.</p>
      <ol className="divide-y divide-line">
        {stops.map((s, i) => (
          <Row key={s.id} stop={s} first={i === 0} last={i === stops.length - 1} />
        ))}
      </ol>
      <button type="button" onClick={onDone} className="min-h-11 self-start font-semibold text-accent underline-offset-4 hover:underline">
        Done
      </button>
    </div>
  );
}
