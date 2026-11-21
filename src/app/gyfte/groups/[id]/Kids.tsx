"use client";

import { useActionState, useState } from "react";
import { addKidAction, addKidParentAction, startKidListAction } from "../../actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

const small =
  "min-h-11 rounded-[var(--radius-control)] border border-ink px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";

/** "Start list" on a kid's row, for their parents. */
export function StartKidList({ groupId, kidIds, year, label = "Start list" }: { groupId: string; kidIds: string[]; year: string; label?: string }) {
  const [state, formAction, pending] = useActionState(startKidListAction, {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="year" value={year} />
      {kidIds.map((k) => (
        <input key={k} type="hidden" name="kidId" value={k} />
      ))}
      <button type="submit" disabled={pending} className={small}>
        {pending ? "Starting…" : label}
      </button>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

type MyKid = { id: string; name: string; parents: { id: string; name: string }[] };

/** Your kids in this group: add a kid, add another parent, start a joint list. */
export function YourKids({
  groupId,
  year,
  kids,
  members,
  canStartJoint,
}: {
  groupId: string;
  year: string;
  kids: MyKid[];
  members: { id: string; name: string }[];
  canStartJoint: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: Parameters<typeof addKidAction>[0], form: FormData) => {
    const next = await addKidAction(prev, form);
    if (next.ok) setAdding(false);
    return next;
  }, {});

  return (
    <section className="flex flex-col gap-3">
      <h2 className="heading">Your kids</h2>
      <p className="text-sm text-soft">
        Kids don&apos;t need an account. Their parents manage their lists and see what&apos;s been claimed.
      </p>
      {kids.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {kids.map((k) => (
            <li key={k.id} className="flex flex-col gap-2 py-3">
              <span className="font-semibold">{k.name}</span>
              <span className="text-sm text-soft">Parents: {k.parents.map((p) => p.name).join(", ")}</span>
              <AddParent kidId={k.id} options={members.filter((m) => !k.parents.some((p) => p.id === m.id))} />
            </li>
          ))}
        </ul>
      )}
      {canStartJoint && (
        <div className="flex flex-col gap-1">
          <StartKidList groupId={groupId} kidIds={kids.map((k) => k.id)} year={year} label={`Start a joint list for ${kids.map((k) => k.name).join(" & ")}`} />
          <span className="text-sm text-soft">For gifts meant for them together, so each is claimed once.</span>
        </div>
      )}
      {adding ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="groupId" value={groupId} />
          <Field label="Kid's name" name="name" required maxLength={80} autoComplete="off" />
          {state.error && <Alert>{state.error}</Alert>}
          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add kid"}
            </Button>
            <Button variant="quiet" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="min-h-11 self-start text-accent underline-offset-4 hover:underline">
          Add a kid
        </button>
      )}
    </section>
  );
}

function AddParent({ kidId, options }: { kidId: string; options: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(addKidParentAction, {});
  if (options.length === 0) return null;
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kidId" value={kidId} />
      <label className="sr-only" htmlFor={`parent-${kidId}`}>
        Add a parent
      </label>
      <select id={`parent-${kidId}`} name="userId" required defaultValue="" className="min-h-11 rounded-[var(--radius-control)] border border-line bg-field px-3 text-sm">
        <option value="" disabled>
          Add a parent…
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="min-h-11 px-1 text-sm text-accent underline-offset-4 hover:underline disabled:opacity-50">
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && <span className="text-sm text-soft">Added ✓</span>}
    </form>
  );
}
