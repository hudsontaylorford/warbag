"use client";

import { useActionState, useRef, useState } from "react";
import { addExpenseAction, updateExpenseAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Choice } from "@/components/ui/Choice";
import { dollars, parseDollars } from "@/lib/mosey/money";

/** A person on the trip's money. Kids are left out of "Everyone" and never pay. */
type P = { id: string; name: string; kid?: boolean; householdId?: string | null };
type Existing = { id: string; description: string; totalCents: number; spentOn: string; paidBy: string; participants: string[]; notes: string };

/**
 * Add or change an expense: what, how much, when, who paid, who it's split
 * with (everyone by default). Shows the split before saving.
 */
export function ExpenseForm({
  tripId,
  people,
  me,
  defaultDay,
  expense,
  onDone,
  prefill,
  receiptId,
  totals,
  onAdded,
}: {
  tripId: string;
  people: P[];
  me: string | null;
  defaultDay: string;
  expense?: Existing;
  onDone?: () => void;
  /** From a receipt photo: suggestions for a person to check before saving. */
  prefill?: { description: string; amount: string; spentOn: string; notes: string };
  receiptId?: string;
  /** From a receipt photo: amounts that could be what was charged, for the person to pick. */
  totals?: { amount: string; label: string }[];
  /** Called once a new expense is saved. */
  onAdded?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const all = people.map((p) => p.id);
  const kids = people.filter((p) => p.kid).map((p) => p.id);
  const adults = people.filter((p) => !p.kid);
  // Adults: track who's left out, so an adult added to the trip later is in by
  // default. Kids: track who's ticked in, so a kid added later stays out.
  const [out, setOut] = useState<string[]>(expense ? adults.map((p) => p.id).filter((id) => !expense.participants.includes(id)) : []);
  const [kidsIn, setKidsIn] = useState<string[]>(expense ? kids.filter((id) => expense.participants.includes(id)) : []);
  const split = all.filter((id) => (kids.includes(id) ? kidsIn.includes(id) : !out.includes(id)));
  const [pick, setPick] = useState("");
  const choose = Boolean(totals && totals.length > 0 && !expense);
  // From a photo, a date that couldn't be read stays empty: never a silent guess.
  const fromPhoto = Boolean(receiptId) && !expense;
  const dateMissing = fromPhoto && !prefill?.spentOn;
  const [amount, setAmount] = useState(expense ? (expense.totalCents / 100).toFixed(2) : (prefill?.amount ?? ""));
  const [state, formAction, pending] = useActionState(async (prev: Parameters<typeof addExpenseAction>[0], form: FormData) => {
    const next = await (expense ? updateExpenseAction : addExpenseAction)(prev, form);
    if (next.ok && !expense) {
      formRef.current?.reset();
      setOut([]);
      setKidsIn([]);
      setAmount("");
      setPick("");
      onAdded?.();
    }
    if (next.ok && expense) onDone?.();
    return next;
  }, {});
  const cents = parseDollars(amount);
  const each = cents && split.length ? Math.floor(cents / split.length) : null;
  const toggle = (id: string, on: boolean) =>
    kids.includes(id) ? setKidsIn(on ? [...kidsIn, id] : kidsIn.filter((x) => x !== id)) : setOut(on ? out.filter((x) => x !== id) : [...out, id]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={expense?.id ?? tripId} />
      {receiptId && <input type="hidden" name="receiptId" value={receiptId} />}
      <Field label="What was it" name="description" required maxLength={200} defaultValue={expense?.description ?? prefill?.description} placeholder="Groceries, dinner, the cabin…" />
      {choose && totals && (
        <Choice
          legend="Which total was charged?"
          name="totalPick"
          value={pick}
          onChange={(v) => {
            setPick(v);
            setAmount(v === "other" ? "" : v);
          }}
          options={[
            ...totals.map((t) => ({ value: t.amount, label: `$${t.amount}`, hint: t.label })),
            { value: "other", label: "Something else", hint: "Type it below" },
          ]}
        />
      )}
      <div className="grid grid-cols-2 items-start gap-3">
        <Field label="Amount ($)" name="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        <Field
          label="Date"
          name="spentOn"
          type="date"
          required
          defaultValue={expense?.spentOn ?? (fromPhoto ? (prefill?.spentOn ?? "") : defaultDay)}
          hint={dateMissing ? "Choose the date on the receipt." : undefined}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Paid by</span>
        <select name="paidBy" required defaultValue={expense?.paidBy ?? me ?? ""} className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base">
          <option value="" disabled>
            Pick who paid…
          </option>
          {adults.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Split with</legend>
        <div className="flex gap-4 text-sm">
          <button
            type="button"
            onClick={() => {
              setOut([]);
              setKidsIn([]);
            }}
            className="min-h-11 text-button"
          >
            {kids.length ? "All adults" : "Everyone"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOut(adults.map((p) => p.id));
              setKidsIn([]);
            }}
            className="min-h-11 text-button"
          >
            Nobody
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          {adults.map((p) => (
            <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" name="participants" value={p.id} checked={split.includes(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} className="size-5 accent-ink" />
              <span className="break-words">{p.name}</span>
            </label>
          ))}
        </div>
        {kids.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-line pt-2">
            <p className="text-sm text-soft">Kids are left out unless you tick them. A kid&apos;s share goes to their household.</p>
            <div className="grid grid-cols-2 gap-x-4">
              {people
                .filter((p) => p.kid)
                .map((p) => (
                  <label key={p.id} className={`flex min-h-11 items-center gap-3 ${p.householdId ? "cursor-pointer" : "text-soft"}`}>
                    <input
                      type="checkbox"
                      name="participants"
                      value={p.id}
                      checked={split.includes(p.id)}
                      disabled={!p.householdId && !split.includes(p.id)}
                      onChange={(e) => toggle(p.id, e.target.checked)}
                      className="size-5 accent-ink"
                    />
                    <span className="break-words">
                      {p.name}
                      {!p.householdId && <span className="block text-xs">No household yet</span>}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        )}
        <p className="text-sm text-soft" aria-live="polite">
          {split.length === 0
            ? "Pick at least one person."
            : `Split ${split.length} ${split.length === 1 ? "way" : "ways"}${each !== null ? `, about ${dollars(each)} each` : ""}.`}
        </p>
      </fieldset>
      <Field label="Notes" name="notes" maxLength={1000} defaultValue={expense?.notes ?? prefill?.notes} hint="Optional" />
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && !expense && (
        <p role="status" className="text-sm text-soft">
          Added ✓
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending || split.length === 0}>
          {pending ? "Saving…" : expense ? "Save" : "Add expense"}
        </Button>
        {onDone && (
          <Button variant="quiet" onClick={onDone}>
            Close
          </Button>
        )}
      </div>
    </form>
  );
}
