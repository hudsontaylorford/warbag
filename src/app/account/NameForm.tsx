"use client";

import { useActionState } from "react";
import { setMyNameAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(setMyNameAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field
        label="Your name"
        name="name"
        defaultValue={name}
        required
        maxLength={80}
        autoComplete="given-name"
        hint="What family and friends see, like on your gift lists."
      />
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && (
        <p role="status" className="text-sm text-soft">
          Saved ✓
        </p>
      )}
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
