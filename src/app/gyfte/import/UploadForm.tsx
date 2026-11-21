"use client";

import { useActionState } from "react";
import { uploadImportAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadImportAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Spreadsheet (.xlsx)</span>
        <input
          type="file"
          name="file"
          required
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="min-h-13 rounded-[var(--radius-control)] border border-line bg-field px-3 py-3 text-base file:mr-3 file:rounded-md file:border-0 file:bg-wash file:px-3 file:py-2 file:font-semibold"
        />
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? "Reading…" : "Read spreadsheet"}
        </Button>
      </div>
    </form>
  );
}
