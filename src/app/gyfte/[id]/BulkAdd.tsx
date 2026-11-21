"use client";

import { useActionState, useMemo, useState } from "react";
import { parseBulk } from "@/lib/gyfte/bulk";
import { storeName } from "@/lib/gyfte/links";
import { addItemsAction } from "../actions";
import type { FormState } from "@/components/ui/form-state";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Paste many gifts at once. The preview updates as you type; untick
 * anything that isn't a gift (like a heading), then add the rest.
 */
export function BulkAdd({ listId, history = false, onDone }: { listId: string; history?: boolean; onDone: () => void }) {
  const [text, setText] = useState("");
  const [skip, setSkip] = useState<number[]>([]);
  const gifts = useMemo(() => parseBulk(text), [text]);
  const count = gifts.filter((g) => !skip.includes(g.index)).length;

  const [state, formAction, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const next = await addItemsAction(prev, form);
    if (next.ok) {
      setText("");
      setSkip([]);
      onDone();
    }
    return next;
  }, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg bg-wash p-4">
      <input type="hidden" name="id" value={listId} />
      {history && <input type="hidden" name="history" value="1" />}
      {skip.map((i) => (
        <input key={i} type="hidden" name="skip" value={i} />
      ))}
      <label htmlFor="bulk-gifts" className="text-sm font-semibold">
        Paste several gifts
      </label>
      <textarea
        id="bulk-gifts"
        name="text"
        rows={6}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // Start likely headings ("Clothes") unticked.
          setSkip(parseBulk(e.target.value).filter((g) => g.likelyHeading).map((g) => g.index));
        }}
        placeholder={"One gift per line. Links, prices and sizes are picked up.\nPaste from notes, a text, or a spreadsheet."}
        className="rounded-lg border border-line bg-page px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />

      {gifts.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">
            {gifts.length === 1 ? "1 gift found" : `${gifts.length} gifts found`}. Untick anything that isn&apos;t one.
          </legend>
          <div className="flex max-h-80 flex-col divide-y divide-line overflow-y-auto border-y border-line">
            {gifts.map((g) => {
              const details = [g.size, g.color, g.price, g.links[0] ? storeName(g.links[0]) : ""].filter(Boolean).join(" · ");
              return (
                <label key={g.index} className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={!skip.includes(g.index)}
                    onChange={(e) => setSkip(e.target.checked ? skip.filter((i) => i !== g.index) : [...skip, g.index])}
                    className="size-5 shrink-0 accent-ink"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words">{g.name}</span>
                    {details && <span className="text-sm text-soft break-words">{details}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending || count === 0}>
          {pending ? "Adding…" : count === 1 ? "Add 1 gift" : `Add ${count} gifts`}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
