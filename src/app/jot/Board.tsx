"use client";

import { useState } from "react";
import { IMPORTANCE, IMPORTANCE_LABEL, type Note } from "@/lib/jot/note";
import { NoteCard } from "./NoteCard";
import { Reorder } from "./Reorder";

const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3";

/**
 * The notes: in your own order (with Reorder), or grouped by label, most
 * pressing first. Grouping only changes the view, never the saved order.
 */
export function Board({ notes, byLabel }: { notes: Note[]; byLabel: boolean }) {
  const [reordering, setReordering] = useState(false);
  if (byLabel) {
    return (
      <div className="flex flex-col gap-6">
        {IMPORTANCE.map((k) => {
          const group = notes.filter((n) => n.importance === k);
          if (!group.length) return null;
          return (
            <section key={k} aria-labelledby={`label-${k}`} className="flex flex-col gap-2">
              <h2 id={`label-${k}`} className="text-sm font-semibold tracking-wide text-soft uppercase">
                {IMPORTANCE_LABEL[k]} <span className="font-normal">({group.length})</span>
              </h2>
              <ul className={grid}>
                {group.map((n) => (
                  <NoteCard key={n.id} note={n} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }
  if (reordering) return <Reorder notes={notes} onDone={() => setReordering(false)} />;
  return (
    <div className="flex flex-col gap-2">
      <ul className={grid} aria-label="Your notes">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </ul>
      {notes.length > 1 && (
        <button type="button" onClick={() => setReordering(true)} className="min-h-11 self-start text-sm text-button">
          Reorder
        </button>
      )}
    </div>
  );
}
