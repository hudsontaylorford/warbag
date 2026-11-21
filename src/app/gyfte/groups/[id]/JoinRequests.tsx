"use client";

import { useActionState } from "react";
import type { JoinRequest } from "@/lib/gyfte/join";
import { approveJoinAction, declineJoinAction } from "../../actions";
import { Alert } from "@/components/ui/Alert";

const small =
  "min-h-11 rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent disabled:opacity-50";

/**
 * Admin: people who asked to join from the family link. The actions live
 * here, not on each row, because an answered request leaves the list when
 * the page refreshes and its confirmation has to stay on screen.
 */
export function JoinRequests({ requests }: { requests: JoinRequest[] }) {
  const [okState, approve, approving] = useActionState(approveJoinAction, {});
  const [noState, decline, declining] = useActionState(declineJoinAction, {});
  const busy = approving || declining;
  const message = okState.ok ? `${okState.message} ✓` : noState.ok ? "Declined. Nothing was created." : null;
  const error = okState.error ?? noState.error;
  if (requests.length === 0 && !message && !error) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="heading">Asked to join</h2>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && <Alert>{error}</Alert>}
      {requests.length > 0 && (
        <>
          <p className="text-sm text-soft">Add creates their account and puts them in this group. No email is sent.</p>
          <ul className="divide-y divide-line border-y border-line">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold break-words">{r.name}</span>
                  <span className="text-sm text-soft break-all">{r.email}</span>
                </div>
                <div className="flex gap-2">
                  <form action={approve}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" disabled={busy} className={`${small} bg-ink text-page`}>
                      Add
                    </button>
                  </form>
                  <form action={decline}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" disabled={busy} className={`${small} bg-wash text-ink hover:bg-line`}>
                      Decline
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
