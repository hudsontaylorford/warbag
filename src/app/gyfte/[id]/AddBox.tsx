"use client";

import { useActionState, useRef, useState } from "react";
import { BulkAdd } from "./BulkAdd";
import { addItemAction } from "../actions";
import type { FormState } from "@/components/ui/form-state";
import { Alert } from "@/components/ui/Alert";

/** The one Add box: type a gift or paste a link, then Add. */
export function AddBox({ listId }: { listId: string }) {
  const [bulk, setBulk] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const next = await addItemAction(prev, form);
    if (next.ok) {
      formRef.current?.reset();
      inputRef.current?.focus();
    }
    return next;
  }, {});

  if (bulk) return <BulkAdd listId={listId} onDone={() => setBulk(false)} />;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={listId} />
      <label htmlFor="add-gift" className="text-sm font-semibold">
        Add a gift
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="add-gift"
          name="text"
          required
          maxLength={2000}
          autoComplete="off"
          placeholder="Type a gift or paste a link"
          className="min-h-13 min-w-0 flex-1 rounded-lg border border-line bg-page px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-13 shrink-0 rounded-lg bg-ink px-5 font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      <button
        type="button"
        onClick={() => setBulk(true)}
        className="min-h-11 self-start px-1 text-sm text-accent underline-offset-4 hover:underline"
      >
        Add several at once
      </button>
    </form>
  );
}
