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

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
    on ? "border-ink bg-ink text-page" : "border-line bg-field text-ink"
  }`;

/** Going / Maybe buttons for one person; tapping the one that's on clears it. */
function Choices({ stopId, person, state, labels, groupLabel }: { stopId: string; person: Person; state: "going" | "maybe" | null; labels: [string, string]; groupLabel: string }) {
  const [result, action, pending] = useActionState(setAttendanceAction, {});
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={stopId} />
      <input type="hidden" name="person" value={person.id} />
      <div className="flex gap-1" role="group" aria-label={groupLabel}>
        {CHOICES.map((c, i) => {
          const on = state === c.state;
          return (
            <button key={c.state} type="submit" name="state" value={on ? "" : c.state} disabled={pending} aria-pressed={on} className={`${chip(on)} min-w-16`}>
              {labels[i]}
            </button>
          );
        })}
      </div>
      {result.error && <Alert>{result.error}</Alert>}
    </form>
  );
}

/**
 * Who's going, on stops that ask (split, limited or optional plans). One
 * tappable summary opens the list; you mark yourself in one tap right on
 * the stop. Organizers can mark anyone from the list. Members only.
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
  const me = people.find((p) => p.me);
  const pad = indent ? "sm:pl-21" : "";
  const summary =
    going.length || maybe.length
      ? [going.length > 0 && `Going: ${names(going, 3)}`, maybe.length > 0 && `Maybe: ${names(maybe, 2)}`].filter(Boolean).join(" · ")
      : "Who's going?";

  return (
    <div className={`-mt-4 flex flex-col gap-1 text-sm ${pad}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="min-h-11 text-left break-words text-accent underline-offset-4 hover:underline"
        >
          {open ? "Done" : summary}
        </button>
        {me && !open && <Choices stopId={stopId} person={me} state={stateOf.get(me.id) ?? null} labels={["I'm going", "Maybe"]} groupLabel="Are you going?" />}
      </div>
      {open && (
        <div className="rounded-[var(--radius-control)] bg-wash px-3 py-1">
          {people.length === 0 ? (
            organizer ? (
              <p className="py-3">
                Add the trip&apos;s people first, on{" "}
                <Link href={`/mosey/${tripId}/money`} className="text-accent underline-offset-4 hover:underline">
                  Money
                </Link>
                .
              </p>
            ) : (
              <p className="py-3">Nobody is on this trip&apos;s people list yet.</p>
            )
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {people.map((p) => {
                const st = stateOf.get(p.id) ?? null;
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0 break-words">
                      {p.name}
                      {p.me && <span className="text-soft"> (you)</span>}
                    </span>
                    {organizer || p.me ? (
                      <Choices stopId={stopId} person={p} state={st} labels={["Going", "Maybe"]} groupLabel={`${p.name}: going?`} />
                    ) : (
                      <span className="text-soft">{st === "going" ? "Going" : st === "maybe" ? "Maybe" : "Not marked"}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
