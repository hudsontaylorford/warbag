"use client";

import { useActionState } from "react";
import type { NameOnly } from "@/lib/gyfte/connect";
import { connectNameAction } from "../../actions";
import { Alert } from "@/components/ui/Alert";

/**
 * Admin: lists filed under a typed name (often from an import), connected
 * to the right person in the group. The action lives here, not per row,
 * because a connected name leaves the list when the page refreshes.
 */
export function ConnectNames({
  groupId,
  names,
  members,
}: {
  groupId: string;
  names: NameOnly[];
  members: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(connectNameAction, {});
  if (names.length === 0 && !state.ok && !state.error) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="heading">Lists under just a name</h2>
      {state.ok && (
        <p role="status" className="text-sm">
          {state.message} ✓
        </p>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      {names.length > 0 && (
        <>
          <p className="text-sm text-soft">
            Connect a name to the person it&apos;s for. Their lists become theirs to edit, every year, and claims on them are
            hidden from them.
          </p>
          <ul className="divide-y divide-line border-y border-line">
            {names.map((n) => (
              <li key={n.name.toLowerCase()} className="py-3">
                <form action={action} className="flex flex-wrap items-end justify-between gap-3">
                  <input type="hidden" name="id" value={groupId} />
                  <input type="hidden" name="name" value={n.name} />
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold break-words">{n.name}</span>
                    <span className="text-sm text-soft">
                      {n.lists} {n.lists === 1 ? "list" : "lists"} · {n.years.join(", ")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      name="userId"
                      required
                      defaultValue=""
                      aria-label={`Who ${n.name} is`}
                      className="min-h-11 rounded-[var(--radius-control)] border border-line bg-field px-2 text-sm"
                    >
                      <option value="" disabled>
                        Who is this?
                      </option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={pending}
                      className="min-h-11 rounded-[var(--radius-control)] bg-ink px-3 text-sm font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                    >
                      Connect
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
