"use client";

import { useActionState } from "react";
import { createTripAction, updateTripAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

type Trip = { id: string; name: string; place: string; startDate: string; endDate: string };

/** New trip, or a trip's details under Manage. */
export function TripForm({ trip }: { trip?: Trip }) {
  const [state, formAction, pending] = useActionState(trip ? updateTripAction : createTripAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {trip && <input type="hidden" name="id" value={trip.id} />}
      <Field label="Trip name" name="name" required maxLength={80} defaultValue={trip?.name} placeholder="Maine 2027" />
      <Field label="Where" name="place" maxLength={120} defaultValue={trip?.place} placeholder="Bar Harbor, ME" hint="Optional" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First day" name="start" type="date" required defaultValue={trip?.startDate} />
        <Field label="Last day" name="end" type="date" required defaultValue={trip?.endDate} />
      </div>
      {trip && <p className="text-sm text-soft">Shortening the trip moves plans on dropped days back to Ideas.</p>}
      {state.error && <Alert>{state.error}</Alert>}
      {trip && state.ok && !pending && (
        <p role="status" className="text-sm text-soft">
          Saved ✓
        </p>
      )}
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? (trip ? "Saving…" : "Creating…") : trip ? "Save" : "Create trip"}
        </Button>
      </div>
    </form>
  );
}
