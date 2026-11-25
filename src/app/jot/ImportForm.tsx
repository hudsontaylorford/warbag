"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { importStickiesAction } from "./actions";

/** Adds notes from the old Stickies app's notes.json (or trash.json) as new notes. */
export function ImportForm() {
  const [state, action, pending] = useActionState(importStickiesAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Stickies file (.json)</span>
        <input
          type="file"
          name="file"
          accept=".json,application/json"
          required
          className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 py-2.5 text-base file:mr-3 file:rounded-[var(--radius-control)] file:border-0 file:bg-wash file:px-3 file:py-1"
        />
      </label>
      <p className="text-sm text-soft">
        Pick notes.json from the old Stickies (or trash.json for its Trash). Each note is added as a new one above what you have, with its colour, label and reminder.
        Reminders already past aren&apos;t sent. Nothing you already have changes.
      </p>
      <div className="max-w-xs">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </div>
      {!pending && state.error && <Alert>{state.error}</Alert>}
      {!pending && state.ok && (
        <p role="status" className="text-sm text-soft">
          {state.message} ✓
        </p>
      )}
    </form>
  );
}
