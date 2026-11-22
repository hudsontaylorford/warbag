"use client";

import { useActionState, useState } from "react";
import { freezeAction, setSettleAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type U = { id: string; name: string; members: string[] };

/** Organizer: Direct, or Through one person (a household or someone on their own). */
export function SettleStyle({ tripId, mode, hub, units }: { tripId: string; mode: "direct" | "through"; hub: string | null; units: U[] }) {
  const [state, action, pending] = useActionState(setSettleAction, {});
  const [m, setM] = useState(mode);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={tripId} />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold">How to settle</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="radio" name="mode" value="direct" checked={m === "direct"} onChange={() => setM("direct")} className="size-5 accent-ink" />
          Pay each other directly
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="radio" name="mode" value="through" checked={m === "through"} onChange={() => setM("through")} className="size-5 accent-ink" />
          Everyone settles with one person
        </label>
      </fieldset>
      {m === "through" && (
        <select name="hub" required defaultValue={hub ?? ""} aria-label="Who collects and pays out" className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base">
          <option value="" disabled>
            Who collects and pays out…
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
      <p className="text-sm text-soft">Either way, everyone ends up paying the same total. This only changes who sends money to whom.</p>
      {state.error && <Alert>{state.error}</Alert>}
      <div className="max-w-xs">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Saving…" : "Use this"}
        </Button>
      </div>
    </form>
  );
}

export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <textarea readOnly value={text} rows={Math.min(14, text.split("\n").length + 1)} aria-label="Message for the group" className="rounded-[var(--radius-control)] border border-line bg-wash px-4 py-3 text-sm" />
      <div className="max-w-xs">
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied ✓" : "Copy message"}
        </Button>
      </div>
    </div>
  );
}

export function FreezeButton({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(freezeAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={tripId} />
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Freeze this version"}
        </Button>
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && (
        <p role="status" className="text-sm text-soft">
          {state.message} ✓
        </p>
      )}
    </form>
  );
}
