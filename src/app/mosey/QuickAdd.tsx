"use client";

import { useActionState, useRef, useState } from "react";
import { addStopAction } from "./actions";
import { Alert } from "@/components/ui/Alert";
import { StopFields } from "./StopFields";

/** One box to add a stop or idea; time, place and the rest are optional. */
export function QuickAdd({ tripId, day, label, placeholder }: { tripId: string; day?: string; label: string; placeholder: string }) {
  const [more, setMore] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: Parameters<typeof addStopAction>[0], form: FormData) => {
    const next = await addStopAction(prev, form);
    if (next.ok) {
      formRef.current?.reset();
      setMore(false);
    }
    return next;
  }, {});
  const id = `add-${day ?? "idea"}`;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={tripId} />
      {day && <input type="hidden" name="day" value={day} />}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name="title"
          required
          maxLength={200}
          autoComplete="off"
          placeholder={placeholder}
          className="min-h-12 min-w-0 flex-1 rounded-[var(--radius-control)] border border-line bg-field px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 shrink-0 rounded-[var(--radius-control)] bg-ink px-4 font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {more ? (
        <StopFields />
      ) : (
        <button type="button" onClick={() => setMore(true)} className="min-h-11 self-start px-1 text-sm text-accent underline-offset-4 hover:underline">
          Add a time, place or link
        </button>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && state.message !== "Added" && (
        <p role="status" className="text-sm text-soft">
          {state.message} ✓
        </p>
      )}
    </form>
  );
}
