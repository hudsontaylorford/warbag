"use client";

import { useActionState, useRef } from "react";
import { approveTripJoinAction, declineTripJoinAction, inviteToTripAction, requestJoinTripAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/** Manage → Invite by email: on warbag and on this trip in one step. */
export function InviteByEmail({ tripId }: { tripId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof inviteToTripAction>[0], form: FormData) => {
    const next = await inviteToTripAction(prev, form);
    if (next.ok) formRef.current?.reset();
    return next;
  }, {});
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={tripId} />
      <Field label="Their name" name="name" required maxLength={80} autoComplete="off" />
      <Field label="Their email" name="email" type="email" inputMode="email" required autoComplete="off" />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Add as</span>
        <select
          name="role"
          defaultValue="contribute"
          className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <option value="contribute">Member</option>
          <option value="manage">Co-organizer</option>
        </select>
        <span className="text-sm text-soft">Members see everything and add ideas and expenses. Co-organizers can also plan, except sharing or deleting the trip.</span>
      </label>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="sendEmail" defaultChecked className="size-5 accent-ink" />
        <span>Email them how to sign in</span>
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && (
        <p role="status" className="text-sm text-soft">
          {state.message} ✓
        </p>
      )}
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
      </div>
    </form>
  );
}

function RequestRow({ r }: { r: { id: string; name: string; email: string } }) {
  const [addState, add, adding] = useActionState(approveTripJoinAction, {});
  const [noState, decline, declining] = useActionState(declineTripJoinAction, {});
  return (
    <li className="flex flex-col gap-2 py-3">
      <span className="flex flex-col">
        <span className="font-semibold break-words">{r.name}</span>
        <span className="text-sm break-words text-soft">{r.email}</span>
      </span>
      <div className="flex gap-3">
        <form action={add}>
          <input type="hidden" name="id" value={r.id} />
          <Button type="submit" disabled={adding || declining}>
            {adding ? "Adding…" : "Add"}
          </Button>
        </form>
        <form action={decline}>
          <input type="hidden" name="id" value={r.id} />
          <Button type="submit" variant="quiet" disabled={adding || declining}>
            {declining ? "Declining…" : "Decline"}
          </Button>
        </form>
      </div>
      {(addState.error || noState.error) && <Alert>{addState.error ?? noState.error}</Alert>}
    </li>
  );
}

/** Manage → Asking to join: from the trip link. Add puts them on the trip and emails them. */
export function JoinRequests({ requests }: { requests: { id: string; name: string; email: string }[] }) {
  if (requests.length === 0) return <p className="text-sm text-soft">Nobody yet. People with the trip link can ask from there.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {requests.map((r) => (
        <RequestRow key={r.id} r={r} />
      ))}
    </ul>
  );
}

/** On the trip link: ask to join with a name and email, now or any time later. */
export function AskToJoinTrip({ token, name, email }: { token: string; name?: string; email?: string }) {
  const [state, action, pending] = useActionState(requestJoinTripAction, {});
  if (state.ok) {
    return (
      <p role="status" className="rounded-[var(--radius-control)] bg-wash p-4">
        Thanks. When the organizer adds you, we&apos;ll email you how to sign in and open the trip.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Field label="Your name" name="name" required maxLength={80} defaultValue={name} autoComplete="name" />
      <Field label="Your email" name="email" type="email" inputMode="email" required defaultValue={email} autoComplete="email" />
      {state.error && <Alert>{state.error}</Alert>}
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? "Asking…" : "Ask to join"}
        </Button>
      </div>
    </form>
  );
}
