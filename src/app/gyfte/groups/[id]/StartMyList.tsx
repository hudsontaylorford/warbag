"use client";

import { useActionState } from "react";
import { startMyGroupListAction } from "../../actions";
import { Alert } from "@/components/ui/Alert";

export function StartMyList({ groupId, year }: { groupId: string; year: string }) {
  const [state, formAction, pending] = useActionState(startMyGroupListAction, {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={groupId} />
      <input type="hidden" name="year" value={year} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg border border-ink px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start my list"}
      </button>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}
