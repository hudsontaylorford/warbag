"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { setAttendanceAction } from "./actions";
import { Alert } from "@/components/ui/Alert";

type Person = { id: string; name: string; me: boolean };
type Mark = { personId: string; state: "going" | "maybe" };

// Two choices; tapping the one that's on clears it (not marked).
const CHOICES = [
  { state: "going", label: "Going" },
  { state: "maybe", label: "Maybe" },
] as const;

/** "Ann, Ben and 3 more" */
function names(list: string[], max = 4) {
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} and ${list.length - max} more`;
}

function PersonRow({ stopId, person, state }: { stopId: string; person: Person; state: "going" | "maybe" | null }) {
  const [result, action, pending] = useActionState(setAttendanceAction, {});
  return (
    <form action={action} className="flex flex-col gap-1 py-2">
      <input type="hidden" name="id" value={stopId} />
      <input type="hidden" name="person" value={person.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words">
          {person.name}
          {person.me && <span className="text-soft"> (you)</span>}
        </span>
        <div className="flex gap-1" role="group" aria-label={`${person.name}: going?`}>
          {CHOICES.map((c) => {
            const on = state === c.state;
            return (
              <button
                key={c.label}
                type="submit"
                name="state"
                value={on ? "" : c.state}
                disabled={pending}
                aria-pressed={on}
                className={`min-h-11 min-w-16 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
                  on ? "border-ink bg-ink text-page" : "border-line bg-field text-ink"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
      {result.error && <Alert>{result.error}</Alert>}
    </form>
  );
}

/**
 * Who's going to a stop, from the trip's people list. Members only. A line
 * of names, and "Who's going" to change it: an organizer can mark anyone, a
 * member only themselves.
 */
export function Attendance({
  tripId,
  stopId,
  people,
  marks,
  organizer,
  indent,
}: {
  tripId: string;
  stopId: string;
  people: Person[];
  marks: Mark[];
  organizer: boolean;
  indent: boolean;
}) {
  const [open, setOpen] = useState(false);
  const name = new Map(people.map((p) => [p.id, p.name]));
  const going = marks.filter((m) => m.state === "going").map((m) => name.get(m.personId) ?? "");
  const maybe = marks.filter((m) => m.state === "maybe").map((m) => name.get(m.personId) ?? "");
  const stateOf = new Map(marks.map((m) => [m.personId, m.state]));
  const editable = organizer ? people : people.filter((p) => p.me);
  const pad = indent ? "sm:pl-21" : "";

  return (
    <div className={`-mt-4 flex flex-col gap-1 text-sm ${pad}`}>
      {!open && (
        <div className="flex flex-wrap items-baseline gap-x-3">
          {(going.length > 0 || maybe.length > 0) && (
            <span className="break-words text-soft">
              {[going.length > 0 && `Going: ${names(going)}`, maybe.length > 0 && `Maybe: ${names(maybe)}`].filter(Boolean).join(" · ")}
            </span>
          )}
          <button type="button" aria-expanded={false} onClick={() => setOpen(true)} className="min-h-11 text-accent underline-offset-4 hover:underline">
            {going.length || maybe.length ? "Change" : "Who's going?"}
          </button>
        </div>
      )}
      {open && (
        <div className="rounded-[var(--radius-control)] bg-wash px-3 py-1">
          {editable.length > 0 ? (
            <div className="flex flex-col divide-y divide-line">
              {editable.map((p) => (
                <PersonRow key={p.id} stopId={stopId} person={p} state={stateOf.get(p.id) ?? null} />
              ))}
            </div>
          ) : organizer ? (
            <p className="py-3">
              Add the trip&apos;s people first, on{" "}
              <Link href={`/mosey/${tripId}/money`} className="text-accent underline-offset-4 hover:underline">
                Money
              </Link>
              .
            </p>
          ) : (
            <p className="py-3">You&apos;re not on this trip&apos;s people list yet. An organizer can add you.</p>
          )}
        </div>
      )}
      {open && (
        <button type="button" aria-expanded={true} onClick={() => setOpen(false)} className="min-h-11 self-start text-accent underline-offset-4 hover:underline">
          Done
        </button>
      )}
    </div>
  );
}
