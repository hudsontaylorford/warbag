"use client";

import { useActionState } from "react";
import { thisIsMeAction } from "./actions";
import { Alert } from "@/components/ui/Alert";

export function ThisIsMe({ token, userId, from }: { token: string; userId: string; from?: string }) {
  const [state, formAction, pending] = useActionState(thisIsMeAction, {});
  if (state.ok) {
    return (
      <p role="status" className="max-w-56 text-right text-sm">
        {state.message} ✓
      </p>
    );
  }
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="userId" value={userId} />
      {from && <input type="hidden" name="from" value={from} />}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-[var(--radius-control)] bg-wash px-3 text-sm font-semibold hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        {pending ? "Sending…" : "This is me"}
      </button>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}
