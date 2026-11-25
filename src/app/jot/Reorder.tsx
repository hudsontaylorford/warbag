"use client";

import { useActionState } from "react";
import { firstLine } from "@/lib/notes";
import type { Note } from "@/lib/jot/note";
import { Alert } from "@/components/ui/Alert";
import { moveNoteAction } from "./actions";

const arrow = "flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-field text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-30";

function Row({ note, first, last }: { note: Note; first: boolean; last: boolean }) {
  const [state, action, pending] = useActionState(moveNoteAction, {});
  const name = firstLine(note.body) || "Empty note";
  return (
    <li className="flex flex-col gap-1 py-2">
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="id" value={note.id} />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <button type="submit" name="direction" value="up" disabled={first || pending} aria-label={`Move ${name} up`} className={arrow}>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
            <path d="M5 12l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="submit" name="direction" value="down" disabled={last || pending} aria-label={`Move ${name} down`} className={arrow}>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
            <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
      {state.error && <Alert>{state.error}</Alert>}
    </li>
  );
}

/** Put notes in order, by tap or keyboard (same pattern as Mosey's Reorder). */
export function Reorder({ notes, onDone }: { notes: Note[]; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <ol className="divide-y divide-line border-y border-line">
        {notes.map((n, i) => (
          <Row key={n.id} note={n} first={i === 0} last={i === notes.length - 1} />
        ))}
      </ol>
      <button type="button" onClick={onDone} className="min-h-11 self-start font-semibold text-button">
        Done
      </button>
    </div>
  );
}
