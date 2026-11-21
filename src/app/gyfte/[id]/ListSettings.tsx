"use client";

import { useActionState, useState } from "react";
import { Choice } from "@/components/ui/Choice";
import { updateListAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function ListSettings({
  listId,
  recipientName,
  date,
  claimsMode,
}: {
  listId: string;
  recipientName: string;
  date: string;
  claimsMode: string;
}) {
  const [state, formAction, pending] = useActionState(updateListAction, {});
  const [mode, setMode] = useState(claimsMode);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={listId} />
      <Field label="Who it's for" name="recipientName" defaultValue={recipientName} required maxLength={80} />
      <Field label="Date" name="date" type="date" defaultValue={date} required />
      <Choice
        legend="Claims"
        name="claimsMode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "anonymous", label: "Anonymous", hint: "Others see a gift is claimed, not by whom." },
          { value: "named", label: "Named", hint: "Others see who claimed each gift." },
          { value: "off", label: "Off", hint: "No claiming on this list." },
        ]}
      />
      <p className="text-sm text-soft">The person this list is for never sees claims.</p>
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
