"use client";

import { useActionState } from "react";
import { daysLeft, type Note } from "@/lib/jot/note";
import { Alert } from "@/components/ui/Alert";
import { restoreNoteAction } from "../actions";
import { JotText } from "../JotText";
import { tint } from "../NoteCard";
import { useNow } from "../useNow";

/** A note in the Trash: its text, days left and Restore. */
export function TrashRow({ note }: { note: Note }) {
  const [state, action, pending] = useActionState(restoreNoteAction, {});
  const now = useNow();
  const left = now === null || !note.trashedAt ? null : daysLeft(note.trashedAt, now);
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className={`line-clamp-4 rounded-[var(--radius-control)] p-3 text-[0.9375rem] leading-snug ${tint[note.colour]}`}>
        {note.body.trim() ? <JotText text={note.body} linkless /> : <p className="text-soft">Empty note</p>}
      </div>
      <form action={action} className="flex items-center justify-between gap-4">
        <input type="hidden" name="id" value={note.id} />
        <span className="text-sm text-soft">{left === null ? "" : left === 1 ? "1 day left" : `${left} days left`}</span>
        <button type="submit" disabled={pending} className="min-h-11 text-button disabled:opacity-50">
          {pending ? "Restoring…" : "Restore"}
        </button>
      </form>
      {!pending && state.error && <Alert>{state.error}</Alert>}
    </li>
  );
}
