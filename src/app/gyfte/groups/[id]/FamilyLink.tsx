"use client";

import { useActionState, useState } from "react";
import { setFamilyLinkAction } from "../../actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/** Admin: the family link for the group chat (copy, replace, turn off). */
export function FamilyLink({ groupId, url }: { groupId: string; url: string | null }) {
  const [state, formAction, pending] = useActionState(setFamilyLinkAction, {});
  const [copied, setCopied] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Family link</h2>
      <p className="text-sm text-soft">
        Post it in the family chat. Anyone with it sees names and gifts, never claims. &quot;This is me&quot; emails that
        person a one-tap sign-in link.
      </p>
      {url ? (
        <>
          <input readOnly value={url} aria-label="Family link" className="min-h-11 rounded-[var(--radius-control)] border border-line bg-wash px-3 text-sm" />
          <div className="flex flex-wrap gap-3">
            <div className="min-w-40 flex-1">
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copied ✓" : "Copy link"}
              </Button>
            </div>
            <form action={formAction} className="min-w-40 flex-1">
              <input type="hidden" name="id" value={groupId} />
              <input type="hidden" name="on" value="1" />
              <Button type="submit" variant="quiet" disabled={pending}>
                Replace link
              </Button>
            </form>
            <form action={formAction} className="min-w-40 flex-1">
              <input type="hidden" name="id" value={groupId} />
              <input type="hidden" name="on" value="0" />
              <Button type="submit" variant="quiet" disabled={pending}>
                Turn off
              </Button>
            </form>
          </div>
        </>
      ) : (
        <form action={formAction} className="max-w-xs">
          <input type="hidden" name="id" value={groupId} />
          <input type="hidden" name="on" value="1" />
          <Button type="submit" variant="quiet" disabled={pending}>
            {pending ? "Making…" : "Make a family link"}
          </Button>
        </form>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && (
        <p role="status" className="text-sm text-soft">
          {state.message} ✓
        </p>
      )}
    </section>
  );
}
