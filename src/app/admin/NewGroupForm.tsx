"use client";

import { useActionState } from "react";
import { createGroupAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function NewGroupForm() {
  const [state, formAction, pending] = useActionState(createGroupAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="New group" name="name" placeholder="Family" required maxLength={80} autoComplete="off" />
      {state.error && <Alert>{state.error}</Alert>}
      <div className="max-w-xs">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Creating…" : "Create group"}
        </Button>
      </div>
    </form>
  );
}
