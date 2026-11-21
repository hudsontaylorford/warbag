"use client";

/** Pick one of a few options: big tappable rows with a radio button. */
export function Choice({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-13 cursor-pointer items-center gap-3 px-4 py-2">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange?.(o.value)}
              className="size-5 accent-ink"
            />
            <span className="flex flex-col">
              <span>{o.label}</span>
              {o.hint && <span className="text-sm text-soft">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
