"use client";

import { useActionState, useState } from "react";
import { askToJoinAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/** For someone not on the family link yet: name and email, then wait for approval. */
export function AskToJoin({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(askToJoinAction, {});

  if (state.ok) {
    return (
      <section role="status" className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-wash p-4">
        <h2 className="heading">Welcome to Gyfte</h2>
        <p>
          Your request is in. Once you&apos;re added, come back to this link, find your name and tap{" "}
          <span className="font-semibold">This is me</span>.
        </p>
      </section>
    );
  }

  if (!open) {
    return (
      <p className="text-sm text-soft">
        Not on here?{" "}
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 font-semibold text-button">
          Ask to join
        </button>
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="token" value={token} />
      <h2 className="heading">Ask to join</h2>
      <p className="text-sm text-soft">The family organizer adds you. Nothing is shared until then.</p>
      <Field label="Your name" name="name" required maxLength={80} autoComplete="name" />
      <Field label="Your email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" />
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
