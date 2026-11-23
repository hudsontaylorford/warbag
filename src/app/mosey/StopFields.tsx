"use client";

import { useId } from "react";
import { Field } from "@/components/ui/Field";
import type { Stop } from "@/lib/mosey/trips";
import { WhenField } from "./WhenField";
import { STATUS_LABEL } from "./format";

/** The optional details of a stop, shared by Add and Edit. */
export function StopFields({ stop, link }: { stop?: Stop; /** A link pasted into the add box. */ link?: string }) {
  // Several add forms can be open at once, so ids must be unique per form.
  const notesId = useId();
  return (
    <div className="flex flex-col gap-3">
      <WhenField when={stop} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Status</span>
        <select
          name="status"
          defaultValue={stop?.status ?? ""}
          className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <option value="">No status</option>
          {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <Field label="Place" name="place" defaultValue={stop?.place ?? ""} maxLength={200} placeholder="Name or address" />
      <Field label="Link" name="link" inputMode="url" defaultValue={stop?.link ?? link ?? ""} placeholder="https://" />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold" htmlFor={notesId}>
          Notes
        </label>
        <textarea
          id={notesId}
          name="notes"
          rows={2}
          maxLength={2000}
          defaultValue={stop?.notes ?? ""}
          className="rounded-[var(--radius-control)] border border-line bg-field px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" name="membersOnly" defaultChecked={stop?.membersOnly} className="size-5 accent-ink" />
        Members only (hide the place, link and notes from the view link)
      </label>
    </div>
  );
}
