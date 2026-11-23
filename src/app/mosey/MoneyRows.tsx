"use client";

import { useActionState, useState } from "react";
import { addPaymentAction, deleteExpenseAction, deletePaymentAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { dollars } from "@/lib/mosey/money";
import { ExpenseForm } from "./ExpenseForm";
import { dayLabel } from "./format";

type P = { id: string; name: string; kid?: boolean; householdId?: string | null };
type E = { id: string; description: string; totalCents: number; spentOn: string; paidBy: string; participants: string[]; notes: string; mine: boolean };

/** One expense: what, how much, who paid, how many it's split with. More to edit. */
export function ExpenseRow({ e, people, me, canEdit, defaultDay, receiptId }: { e: E; people: P[]; me: string | null; canEdit: boolean; defaultDay: string; receiptId?: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [delState, delAction, deleting] = useActionState(deleteExpenseAction, {});
  const name = new Map(people.map((p) => [p.id, p.name]));
  // "everyone" means every adult and no kids (kids are left out by default).
  const adults = people.filter((p) => !p.kid);
  const everyone = e.participants.length === adults.length && adults.every((p) => e.participants.includes(p.id));
  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold break-words">{e.description}</span>
          <span className="text-sm text-soft">
            {name.get(e.paidBy)} paid · {everyone ? "everyone" : e.participants.map((p) => name.get(p)).join(", ")} · {dayLabel(e.spentOn)}
          </span>
          {e.notes && <span className="text-sm break-words">{e.notes}</span>}
          {receiptId && (
            <a href={`/mosey/receipts/${receiptId}`} target="_blank" rel="noopener" className="text-sm text-accent underline-offset-4 hover:underline">
              Receipt ›
            </a>
          )}
        </div>
        <span className="shrink-0 font-semibold tabular-nums">{dollars(e.totalCents)}</span>
        {canEdit && (
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="min-h-11 w-12 shrink-0 text-right text-sm text-accent underline-offset-4 hover:underline">
            {open ? "Close" : "More"}
          </button>
        )}
      </div>
      {canEdit && open && (
        <div className="flex flex-col gap-4 rounded-[var(--radius-control)] bg-wash p-4">
          <ExpenseForm tripId="" people={people} me={me} defaultDay={defaultDay} expense={e} onDone={() => setOpen(false)} />
          <div className="border-t border-line pt-4">
            {!confirm ? (
              <div className="max-w-xs">
                <Button variant="quiet" onClick={() => setConfirm(true)}>
                  Delete
                </Button>
              </div>
            ) : (
              <form action={delAction} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={e.id} />
                <p className="text-sm">Delete {e.description}? It comes out of everyone&apos;s figures. It stays in the change log.</p>
                <div className="flex gap-3">
                  <Button type="submit" variant="danger" disabled={deleting}>
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </Button>
                  <Button variant="quiet" onClick={() => setConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            {delState.error && <Alert>{delState.error}</Alert>}
          </div>
        </div>
      )}
    </div>
  );
}

type Pay = { id: string; from: string; to: string; amountCents: number; paidOn: string; note: string; mine: boolean };

export function PaymentRow({ p, people, canEdit }: { p: Pay; people: P[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(deletePaymentAction, {});
  const name = new Map(people.map((x) => [x.id, x.name]));
  return (
    <div className="flex flex-col gap-1 py-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="break-words">
            <span className="font-semibold">{name.get(p.from)}</span> paid <span className="font-semibold">{name.get(p.to)}</span>
          </span>
          <span className="text-sm text-soft">{[dayLabel(p.paidOn), p.note].filter(Boolean).join(" · ")}</span>
        </div>
        <span className="shrink-0 font-semibold tabular-nums">{dollars(p.amountCents)}</span>
        {canEdit && (
          <form action={action}>
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" disabled={pending} className="min-h-11 w-12 text-right text-sm text-accent underline-offset-4 hover:underline disabled:opacity-50">
              {pending ? "…" : "Delete"}
            </button>
          </form>
        )}
      </div>
      {state.error && <Alert>{state.error}</Alert>}
    </div>
  );
}

/** Money one person already gave another (a share paid up front, or a settle-up payment). */
export function PaymentForm({ tripId, people, me, defaultDay }: { tripId: string; people: P[]; me: string | null; defaultDay: string }) {
  const [state, formAction, pending] = useActionState(addPaymentAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={tripId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Who paid</span>
          <select name="from" required defaultValue={me ?? ""} className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base">
            <option value="" disabled>
              Pick…
            </option>
            {people
              .filter((p) => !p.kid)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Paid to</span>
          <select name="to" required defaultValue="" className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base">
            <option value="" disabled>
              Pick…
            </option>
            {people
              .filter((p) => !p.kid)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ($)" name="amount" inputMode="decimal" required placeholder="0.00" />
        <Field label="Date" name="paidOn" type="date" required defaultValue={defaultDay} />
      </div>
      <Field label="Note" name="note" maxLength={200} placeholder="My share of the rental" hint="Optional" />
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && (
        <p role="status" className="text-sm text-soft">
          Recorded ✓
        </p>
      )}
      <div className="max-w-xs">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
