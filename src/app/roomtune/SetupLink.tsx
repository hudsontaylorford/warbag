"use client";

import { useActionState, useState } from "react";
import { createLinkAction, revokeLinkAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/** The view-only link: anyone with it sees this setup's result, presets and rounds, without signing in. */
export function SetupLink({ setupId, links, siteUrl }: { setupId: string; links: { id: string; token: string }[]; siteUrl: string }) {
  const [makeState, makeAction, making] = useActionState(createLinkAction, {});
  const [offState, offAction, turningOff] = useActionState(revokeLinkAction, {});
  const [copied, setCopied] = useState(false);
  const link = links[0];
  const url = link ? `${siteUrl}/rt/${link.token}` : "";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="heading">View link</h2>
      <p className="text-sm text-soft">Anyone with it sees this setup&apos;s result, presets and rounds without signing in. They can&apos;t change anything.</p>
      {link ? (
        <>
          <input
            readOnly
            value={url}
            aria-label="View link"
            className="min-h-12 rounded-[var(--radius-control)] border border-line bg-wash px-4 text-base"
            onFocus={(e) => e.target.select()}
          />
          <div className="flex flex-wrap gap-3">
            <Button
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
            <form action={offAction}>
              <input type="hidden" name="id" value={setupId} />
              <input type="hidden" name="linkId" value={link.id} />
              <Button type="submit" variant="quiet" disabled={turningOff}>
                {turningOff ? "Turning off…" : "Turn off"}
              </Button>
            </form>
          </div>
        </>
      ) : (
        <form action={makeAction} className="max-w-xs">
          <input type="hidden" name="id" value={setupId} />
          <Button type="submit" variant="quiet" disabled={making}>
            {making ? "Making…" : "Make a view link"}
          </Button>
        </form>
      )}
      {(makeState.error || offState.error) && <Alert>{makeState.error ?? offState.error}</Alert>}
    </section>
  );
}
