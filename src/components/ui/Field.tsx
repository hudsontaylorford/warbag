import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

/** A labeled text input. The label is always visible; hints sit under it. */
export function Field({ label, hint, id, className = "", ...rest }: Props) {
  const inputId = id ?? rest.name;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={hintId}
        className={
          "min-h-13 rounded-lg border border-line bg-page px-4 text-base " +
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent " +
          className
        }
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-sm text-soft">
          {hint}
        </p>
      )}
    </div>
  );
}
