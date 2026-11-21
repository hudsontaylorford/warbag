"use client";

import { useActionState, useState } from "react";
import type { FormState } from "./form-state";
import { Button } from "./Button";
import { Field } from "./Field";
import { Alert } from "./Alert";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** Result line under a form: "Saved ✓" only after the server confirms. */
function Result({ state, pending }: { state: FormState; pending: boolean }) {
  if (pending) return null;
  if (state.error) return <Alert>{state.error}</Alert>;
  if (state.ok)
    return (
      <p role="status" className="text-sm text-soft">
        {state.message ?? "Saved"} ✓
      </p>
    );
  return null;
}

/** A section heading with a short optional hint, used on admin pages. */
export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && <p className="text-sm text-soft">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** A set of checkboxes saved together ("Save" sets exactly what's ticked). */
export function CheckboxListForm({
  action,
  id,
  legend,
  options,
  selected,
  empty,
  submitLabel = "Save",
  hidden = {},
}: {
  action: Action;
  id: string;
  legend: string;
  options: { value: string; label: string; hint?: string; disabled?: boolean }[];
  selected: string[];
  empty?: string;
  submitLabel?: string;
  /** Extra hidden form fields. */
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [dirty, setDirty] = useState(false);
  if (options.length === 0) return <p className="text-soft">{empty ?? "Nothing to choose yet."}</p>;
  return (
    <form action={(form) => { setDirty(false); return formAction(form); }} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <fieldset className="flex flex-col divide-y divide-line border-y border-line" onChange={() => setDirty(true)}>
        <legend className="sr-only">{legend}</legend>
        {options.map((o) => (
          <label key={o.value} className="flex min-h-13 cursor-pointer items-center gap-3 py-2">
            <input
              type="checkbox"
              name="value"
              value={o.value}
              defaultChecked={selected.includes(o.value)}
              disabled={o.disabled}
              className="size-5 accent-ink"
            />
            <span className="flex flex-col">
              <span>{o.label}</span>
              {o.hint && <span className="text-sm text-soft">{o.hint}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
      {!dirty && <Result state={state} pending={pending} />}
    </form>
  );
}

/** One text field with a Save button (names). */
export function TextForm({
  action,
  id,
  label,
  value,
  required,
}: {
  action: Action;
  id: string;
  label: string;
  value: string;
  required?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <Field label={label} name="name" defaultValue={value} required={required} maxLength={80} />
      <div className="max-w-xs">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <Result state={state} pending={pending} />
    </form>
  );
}

/**
 * A destructive action in two taps: the first shows what will happen, the
 * second does it. No pop-up dialog.
 */
export function ConfirmForm({
  action,
  id,
  label,
  consequence,
  hidden = {},
}: {
  action: Action;
  id: string;
  label: string;
  consequence: string;
  /** Extra hidden form fields. */
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <div className="max-w-xs">
        <Button variant="quiet" onClick={() => setAsking(true)}>
          {label}
        </Button>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <p className="text-sm">{consequence}</p>
      <div className="flex max-w-sm gap-3">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Working…" : `Yes, ${label.toLowerCase()}`}
        </Button>
        <Button variant="quiet" disabled={pending} onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
      <Result state={state} pending={pending} />
    </form>
  );
}
