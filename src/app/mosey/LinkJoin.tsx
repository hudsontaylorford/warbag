"use client";

import { useActionState, useState } from "react";
import { joinByLinkAction, openGuestLinkAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Choice } from "@/components/ui/Choice";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/**
 * On a trip link that lets people join: "Who are you?" Pick a name from the
 * trip's people, or type yours. Signed in, you join as yourself.
 */
export function JoinByLink({ token, names, signedInAs }: { token: string; names: { id: string; name: string }[]; signedInAs?: string }) {
  const [state, action, pending] = useActionState(joinByLinkAction, {});
  const [picked, setPicked] = useState(names.length ? "" : "new");
  const typing = picked === "new";
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {names.length > 0 && (
        <Choice
          legend="Who are you?"
          name="person"
          value={picked}
          onChange={setPicked}
          options={[...names.map((n) => ({ value: n.id, label: n.name })), { value: "new", label: "Someone else" }]}
        />
      )}
      {names.length === 0 && <input type="hidden" name="person" value="new" />}
      {typing && <Field label="Your name" name="name" required maxLength={80} autoComplete="name" defaultValue={signedInAs} />}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="max-w-xs">
        <Button type="submit" disabled={pending || !picked}>
          {pending ? "Joining…" : "Join"}
        </Button>
      </div>
    </form>
  );
}

/** A guest's own link: one tap to open the trip as them on this device. */
export function OpenGuestLink({ token, name }: { token: string; name: string }) {
  const [state, action, pending] = useActionState(openGuestLinkAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert>{state.error}</Alert>}
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? "Opening…" : `Open the trip as ${name}`}
        </Button>
      </div>
    </form>
  );
}

/** For a guest on the trip: their own link, to come back on another device. */
export function YourLink({ name, url }: { name: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <details className="rounded-[var(--radius-control)] bg-wash px-4 py-2">
      <summary className="min-h-11 cursor-pointer content-center text-sm">
        You joined as <span className="font-semibold">{name}</span> · <span className="text-accent">Your link</span>
      </summary>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-sm text-soft">
          This device remembers you. To come back on another phone or computer, open your own link there. It&apos;s yours: don&apos;t share it.
        </p>
        <input readOnly value={url} aria-label="Your link" className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-4 text-base" onFocus={(e) => e.target.select()} />
        <div className="max-w-xs">
          <Button
            variant="quiet"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </Button>
        </div>
      </div>
    </details>
  );
}
