"use client";

import { useActionState } from "react";
import { updateListAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function ListSettings({ listId, recipientName, date }: { listId: string; recipientName: string; date: string }) {
  const [state, formAction, pending] = useActionState(updateListAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={listId} />
      <Field label="Who it's for" name="recipientName" defaultValue={recipientName} required maxLength={80} />
      <Field label="Date" name="date" type="date" defaultValue={date} required />
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && (
        <p role="status" className="text-sm text-soft">
          Saved ✓
        </p>
      )}
      <div className="max-w-xs">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
