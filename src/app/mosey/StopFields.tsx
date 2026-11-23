"use client";

import { useId, useState } from "react";
import { Field } from "@/components/ui/Field";
import type { Stop } from "@/lib/mosey/trips";
import { WhenField } from "./WhenField";
import { MEAL_LABEL, STATUS_LABEL } from "./format";

/** The optional details of a stop, shared by Add and Edit. */
export function StopFields({ stop, link }: { stop?: Stop; /** A link pasted into the add box. */ link?: string }) {
  // Several add forms can be open at once, so ids must be unique per form.
  const notesId = useId();
  const [meal, setMeal] = useState<string>(stop?.meal ?? "");
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
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Meal</span>
        <select
          name="meal"
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
          className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <option value="">Not a meal</option>
          {(Object.keys(MEAL_LABEL) as (keyof typeof MEAL_LABEL)[]).map((m) => (
            <option key={m} value={m}>
              {MEAL_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      {meal ? (
        <Field
          label="Who's handling it"
          name="handledBy"
          maxLength={200}
          defaultValue={stop?.handledBy ?? ""}
          placeholder="Molly cooking, Graham brings wine"
          hint="Optional. Cooking, bringing or booking."
        />
      ) : (
        <input type="hidden" name="handledBy" value="" />
      )}
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
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="askWho" defaultChecked={stop?.askWho} className="mt-0.5 size-5 shrink-0 accent-ink" />
        <span>
          Ask who&apos;s going
          <span className="block text-soft">For plans not everyone does: a split day, limited seats, an optional night out.</span>
        </span>
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" name="membersOnly" defaultChecked={stop?.membersOnly} className="size-5 accent-ink" />
        Members only (hide the place, link and notes from the view link)
      </label>
    </div>
  );
}
