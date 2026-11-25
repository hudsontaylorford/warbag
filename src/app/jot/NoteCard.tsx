"use client";

import Link from "next/link";
import { IMPORTANCE_LABEL, type Note } from "@/lib/jot/note";
import { JotText } from "./JotText";
import { useNow, whenLabel } from "./useNow";

export const tint: Record<Note["colour"], string> = {
  yellow: "bg-jot-yellow",
  pink: "bg-jot-pink",
  blue: "bg-jot-blue",
  green: "bg-jot-green",
  orange: "bg-jot-orange",
  lilac: "bg-jot-lilac",
};

/** The reminder line on a note: "Remind Tue, Dec 2, 9:00 AM", red once it's due. */
export function ReminderLine({ note }: { note: Pick<Note, "remindAt" | "remindBy"> }) {
  const now = useNow();
  if (!note.remindAt || now === null) return null;
  const due = Date.parse(note.remindAt) <= now;
  return (
    <p className={`text-sm ${due ? "font-semibold text-red-700" : "text-soft"}`}>
      {due ? "Due " : "Remind "}
      {whenLabel(note.remindAt, now)}
      {!due && note.remindBy === "email" && " · email"}
    </p>
  );
}

/** One note on the board: its colour, label, text (folded when long) and reminder. Tap to open it. */
export function NoteCard({ note }: { note: Note }) {
  const now = useNow();
  const due = note.remindAt !== null && now !== null && Date.parse(note.remindAt) <= now;
  const label = note.importance === "none" ? null : IMPORTANCE_LABEL[note.importance];
  return (
    <li className="min-w-0">
      <Link
        href={`/jot/${note.id}`}
        className={`flex h-full min-h-28 flex-col gap-2 rounded-[var(--radius-control)] p-3 text-ink ${tint[note.colour]} ${due ? "outline-2 outline-red-700" : ""} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
      >
        {label && <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>}
        <div className="line-clamp-[8] text-[0.9375rem] leading-snug">
          {note.body.trim() ? <JotText text={note.body} linkless /> : <p className="text-soft">Empty note</p>}
        </div>
        <div className="mt-auto">
          <ReminderLine note={note} />
        </div>
      </Link>
    </li>
  );
}
