"use client";

import { useActionState, useRef } from "react";
import { inviteAction } from "./actions";
import type { FormState } from "@/components/ui/form-state";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

export function InviteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const next = await inviteAction(prev, form);
    if (next.ok) formRef.current?.reset();
    return next;
  }, {});

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" inputMode="email" autoComplete="off" required />
      <Field label="Name" name="name" hint="Optional. How warbag greets them, and how others see them." autoComplete="off" maxLength={80} />
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="sendEmail" defaultChecked className="size-5 accent-ink" />
        <span>Email them how to sign in</span>
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && (
        <p role="status" className="text-sm text-soft">
          {state.message} ✓
        </p>
      )}
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
      </div>
    </form>
  );
}
