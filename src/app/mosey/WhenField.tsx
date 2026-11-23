"use client";

import { useId, useState } from "react";
import { parseWhen, whenInput, type Part, type When } from "@/lib/mosey/when";

const CHIPS: { part: Part; label: string; value: string }[] = [
  { part: "morning", label: "Morning", value: "Morning" },
  { part: "afternoon", label: "Afternoon", value: "Afternoon" },
  { part: "evening", label: "Evening", value: "Evening" },
  { part: "tbd", label: "TBD", value: "TBD" },
];

/**
 * When a stop happens, typed the way Crewmaxxing takes times: "7pm", "9:30a",
 * "14:30", "noon", or a part of the day. One tap for Morning, Afternoon,
 * Evening or TBD. Empty is any time. Says how a bare hour was read.
 */
export function WhenField({ when }: { when?: When }) {
  const id = useId();
  const [value, setValue] = useState(when ? whenInput(when) : "");
  const [touched, setTouched] = useState(false);
  const parsed = parseWhen(value);

  let hint: { bad?: boolean; text: string };
  if (!parsed.ok) hint = touched ? { bad: true, text: parsed.error } : { text: "Like 7pm, 9:30a or 14:30" };
  else if (parsed.assumed && parsed.time) hint = { text: `Read as ${whenInput(parsed)}. Add a or p to change.` };
  else if (!parsed.time && !parsed.part) hint = { text: "Empty is any time." };
  else hint = { text: "" };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        When
      </label>
      <input
        id={id}
        name="time"
        autoComplete="off"
        placeholder="Any time"
        value={value}
        aria-invalid={touched && !parsed.ok ? true : undefined}
        aria-describedby={`${id}-hint`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setTouched(true);
          // Show the full reading in the box ("7" → "7:00 AM") so it's easy to correct.
          if (parsed.ok && (parsed.time || parsed.part)) setValue(whenInput(parsed));
        }}
        className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
      <span id={`${id}-hint`} aria-live="polite" className={`min-h-5 text-sm ${hint.bad ? "font-semibold text-ember" : "text-soft"}`}>
        {hint.text}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Part of the day">
        {CHIPS.map((c) => {
          const on = parsed.ok && !parsed.time && parsed.part === c.part;
          return (
            <button
              key={c.part}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setValue(on ? "" : c.value);
                setTouched(false);
              }}
              className={`min-h-11 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${on ? "border-ink bg-ink text-page" : "border-line bg-field text-ink"}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
