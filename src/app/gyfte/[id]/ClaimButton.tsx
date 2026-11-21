"use client";

import { useActionState } from "react";
import type { ItemClaim } from "@/lib/gyfte/data";
import { claimAction, unclaimAction } from "../actions";
import { Alert } from "@/components/ui/Alert";

const small =
  "min-h-11 rounded-lg px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent disabled:opacity-50";

/**
 * The claim line under a gift, for people who may see claims. Never
 * rendered for the person the list is for: the server sends them no
 * claim data at all.
 */
export function ClaimButton({
  itemId,
  claim,
  canClaim,
  readOnly = false,
}: {
  itemId: string;
  claim: ItemClaim;
  canClaim: boolean;
  /** "View as" preview: show the state, no buttons. */
  readOnly?: boolean;
}) {
  const [claimState, claimFormAction, claiming] = useActionState(claimAction, {});
  const [undoState, undoFormAction, undoing] = useActionState(unclaimAction, {});
  const error = claimState.error ?? undoState.error;

  let body: React.ReactNode;
  if (readOnly) {
    if (!claim && !canClaim) return null;
    body = (
      <span className="text-sm text-soft">
        {claim?.mine ? "You're getting this ✓" : claim ? (claim.by ? `Claimed by ${claim.by}` : "Claimed") : "Not claimed yet"}
      </span>
    );
  } else if (claim?.mine) {
    body = (
      <form action={undoFormAction} className="flex items-center gap-3">
        <input type="hidden" name="id" value={itemId} />
        <span className="text-sm font-semibold">You&apos;re getting this ✓</span>
        <button type="submit" disabled={undoing} className="min-h-11 px-1 text-sm text-accent underline-offset-4 hover:underline">
          {undoing ? "Undoing…" : "Undo"}
        </button>
      </form>
    );
  } else if (claim) {
    body = <span className="text-sm text-soft">{claim.by ? `Claimed by ${claim.by}` : "Claimed"}</span>;
  } else if (canClaim) {
    body = (
      <form action={claimFormAction}>
        <input type="hidden" name="id" value={itemId} />
        <button type="submit" disabled={claiming} className={`${small} border border-ink`}>
          {claiming ? "Claiming…" : "I'll get this"}
        </button>
      </form>
    );
  } else {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {body}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
