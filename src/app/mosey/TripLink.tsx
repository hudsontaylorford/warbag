"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { createLinkAction, revokeLinkAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

const noSubscribe = () => () => {};

/** The trip link: anyone with it sees Plan and Ideas (never money or members-only details) and can ask to join. */
export function TripLink({ tripId, tripName, links, siteUrl }: { tripId: string; tripName: string; links: { id: string; token: string }[]; siteUrl: string }) {
  const [makeState, makeAction, making] = useActionState(createLinkAction, {});
  const [offState, offAction, turningOff] = useActionState(revokeLinkAction, {});
  const [copied, setCopied] = useState(false);
  // Phones get the share sheet (Messages, email); everyone gets Copy.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const link = links[0];
  const url = link ? `${siteUrl}/m/${link.token}` : "";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="heading">Trip link</h2>
      <p className="text-sm text-soft">
        This is the link to send. Anyone with it sees the plan and ideas without signing in (never money or members-only details) and can ask to join
        with their email. You add them under Asking to join. The address in your browser bar is for people already on the trip.
      </p>
      {link ? (
        <>
          <input readOnly value={url} aria-label="Trip link" className="min-h-12 rounded-[var(--radius-control)] border border-line bg-wash px-4 text-base" onFocus={(e) => e.target.select()} />
          <div className="flex flex-wrap gap-3">
            {canShare && (
              <Button
                onClick={async () => {
                  try {
                    await navigator.share({ title: tripName, text: `${tripName} on Mosey`, url });
                  } catch {
                    // Closed the share sheet: nothing to do.
                  }
                }}
              >
                Share link
              </Button>
            )}
            <Button
              variant={canShare ? "quiet" : undefined}
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
              <input type="hidden" name="id" value={tripId} />
              <input type="hidden" name="linkId" value={link.id} />
              <Button type="submit" variant="quiet" disabled={turningOff}>
                {turningOff ? "Turning off…" : "Turn off"}
              </Button>
            </form>
          </div>
        </>
      ) : (
        <form action={makeAction} className="max-w-xs">
          <input type="hidden" name="id" value={tripId} />
          <Button type="submit" variant="quiet" disabled={making}>
            {making ? "Making…" : "Make a trip link"}
          </Button>
        </form>
      )}
      {(makeState.error || offState.error) && <Alert>{makeState.error ?? offState.error}</Alert>}
    </section>
  );
}
