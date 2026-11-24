"use client";

import { useActionState, useState } from "react";
import { addPersonAction, removePersonAction, updatePersonAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

type Person = { id: string; name: string; userId: string | null; householdId: string | null; kid: boolean };
type Household = { id: string; name: string };
type Account = { id: string; name: string };

function Fields({ person, households, accounts }: { person?: Person; households: Household[]; accounts: Account[] }) {
  const listId = `households-${person?.id ?? "new"}`;
  return (
    <>
      <Field label="Name" name="name" required maxLength={80} defaultValue={person?.name} />
      <Field
        label="Household"
        name="household"
        maxLength={80}
        list={listId}
        defaultValue={households.find((h) => h.id === person?.householdId)?.name ?? ""}
        hint="Couples who share money get the same household name. Empty: on their own."
      />
      <datalist id={listId}>
        {households.map((h) => (
          <option key={h.id} value={h.name} />
        ))}
      </datalist>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input type="checkbox" name="kid" defaultChecked={person?.kid} className="mt-0.5 size-5 shrink-0 accent-ink" />
        <span className="flex flex-col">
          <span className="font-semibold">Kid</span>
          <span className="text-sm text-soft">On the plan and who&apos;s going. Left out of splits unless ticked in, and never pays. Give them their family&apos;s household.</span>
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Their warbag account</span>
        <select name="userId" defaultValue={person?.userId ?? ""} className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base">
          <option value="">None (just a name)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-soft">Linking shows them &quot;You owe&quot; on their own screen.</span>
      </label>
    </>
  );
}

function PersonRow({ tripId, p, households, accounts }: { tripId: string; p: Person; households: Household[]; accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [saveState, save, saving] = useActionState(updatePersonAction, {});
  const [rmState, remove, removing] = useActionState(removePersonAction, {});
  const household = households.find((h) => h.id === p.householdId)?.name;
  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold break-words">{p.name}</span>
          <span className="text-sm text-soft">{[p.kid ? "Kid" : null, household ? `Household: ${household}` : "On their own", p.userId ? "Has an account" : null].filter(Boolean).join(" · ")}</span>
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="min-h-11 w-12 shrink-0 text-right text-sm text-button">
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-4 rounded-[var(--radius-control)] bg-wash p-4">
          <form action={save} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={tripId} />
            <input type="hidden" name="personId" value={p.id} />
            <Fields person={p} households={households} accounts={accounts} />
            {saveState.error && <Alert>{saveState.error}</Alert>}
            {saveState.ok && !saving && (
              <p role="status" className="text-sm text-soft">
                Saved ✓ Balances updated.
              </p>
            )}
            <div className="max-w-xs">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
          <form action={remove} className="border-t border-line pt-4">
            <input type="hidden" name="id" value={tripId} />
            <input type="hidden" name="personId" value={p.id} />
            <div className="max-w-xs">
              <Button type="submit" variant="quiet" disabled={removing}>
                {removing ? "Removing…" : "Remove from the trip's money"}
              </Button>
            </div>
            {rmState.error && <Alert>{rmState.error}</Alert>}
          </form>
        </div>
      )}
    </div>
  );
}

/** Organizer: who's in the money, their households, and linked accounts. */
export function PeopleManager({ tripId, people, households, accounts }: { tripId: string; people: Person[]; households: Household[]; accounts: Account[] }) {
  const [state, add, adding] = useActionState(addPersonAction, {});
  return (
    <div className="flex flex-col gap-4">
      {people.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {people.map((p) => (
            <li key={p.id}>
              <PersonRow tripId={tripId} p={p} households={households} accounts={accounts} />
            </li>
          ))}
        </ul>
      )}
      <form action={add} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={tripId} />
        <p className="text-sm font-semibold">Add someone</p>
        <Fields households={households} accounts={accounts} />
        {state.error && <Alert>{state.error}</Alert>}
        <div className="max-w-xs">
          <Button type="submit" variant="quiet" disabled={adding}>
            {adding ? "Adding…" : "Add person"}
          </Button>
        </div>
      </form>
    </div>
  );
}
