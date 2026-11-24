"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { MyClaim } from "@/lib/gyfte/claims";
import { dismissClaimAction, unclaimAction } from "../actions";
import { Alert } from "@/components/ui/Alert";

const textButton = "min-h-11 shrink-0 px-1 text-sm text-button disabled:opacity-50";

export function ClaimRow({ claim }: { claim: MyClaim }) {
  const [undoState, undoAction, undoing] = useActionState(unclaimAction, {});
  const [dismissState, dismissAction, dismissing] = useActionState(dismissClaimAction, {});

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          {claim.link && !claim.removed ? (
            <a href={claim.link} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold break-words text-accent underline-offset-4 hover:underline">
              {claim.itemName}
            </a>
          ) : (
            <span className={`font-semibold break-words ${claim.removed ? "line-through" : ""}`}>{claim.itemName}</span>
          )}
          <span className="text-sm text-soft">
            {claim.listId && !claim.removed ? (
              <Link href={`/gyfte/${claim.listId}`} className="underline-offset-4 hover:underline">
                {claim.listTitle}
              </Link>
            ) : (
              claim.listTitle
            )}
            {claim.received && " · They marked it Got it"}
          </span>
          {claim.removed && <span className="text-sm">Removed from the list. You may not need to get it.</span>}
          {claim.lostAccess && <span className="text-sm">This list isn&apos;t shared with you anymore.</span>}
        </div>
        {claim.removed || claim.lostAccess ? (
          <form action={dismissAction}>
            <input type="hidden" name="id" value={claim.id} />
            <button type="submit" disabled={dismissing} className={textButton}>
              {dismissing ? "Clearing…" : "Clear"}
            </button>
          </form>
        ) : (
          <form action={undoAction}>
            <input type="hidden" name="id" value={claim.itemId ?? ""} />
            <button type="submit" disabled={undoing} className={textButton}>
              {undoing ? "Undoing…" : "Undo"}
            </button>
          </form>
        )}
      </div>
      {(undoState.error || dismissState.error) && <Alert>{undoState.error ?? dismissState.error}</Alert>}
    </div>
  );
}
