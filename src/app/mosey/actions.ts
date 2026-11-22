"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/run-action";
import type { FormState } from "@/components/ui/form-state";
import {
  addStop,
  createTrip,
  createTripLink,
  deleteStop,
  deleteTrip,
  planStop,
  revokeTripLink,
  setTripMembers,
  updateStop,
  updateTrip,
} from "@/lib/mosey/trips";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const stopFields = (form: FormData) => ({
  title: text(form, "title"),
  time: text(form, "time"),
  place: text(form, "place"),
  link: text(form, "link"),
  notes: text(form, "notes"),
  membersOnly: form.get("membersOnly") === "on",
});
const tripFields = (form: FormData) => ({
  name: text(form, "name"),
  place: text(form, "place"),
  start: text(form, "start"),
  end: text(form, "end"),
});

export async function createTripAction(_: FormState, form: FormData): Promise<FormState> {
  let id = "";
  const state = await runAction(async (actor) => {
    id = await createTrip(actor, tripFields(form));
  });
  if (state.ok) redirect(`/mosey/${id}`);
  return state;
}

export async function updateTripAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => updateTrip(actor, text(form, "id"), tripFields(form)));
}

export async function deleteTripAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await runAction((actor) => deleteTrip(actor, text(form, "id")));
  if (state.ok) redirect("/mosey");
  return state;
}

export async function addStopAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    const { planned } = await addStop(actor, text(form, "id"), { ...stopFields(form), day: text(form, "day") || undefined });
    return text(form, "day") && !planned ? "Added to Ideas, suggested for that day" : "Added";
  });
}

export async function updateStopAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => updateStop(actor, text(form, "id"), stopFields(form)));
}

export async function planStopAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => planStop(actor, text(form, "id"), text(form, "day") || null));
}

export async function deleteStopAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => deleteStop(actor, text(form, "id")));
}

/** Checkbox values are "g:<groupId>" or "p:<userId>". */
export async function setMembersAction(_: FormState, form: FormData): Promise<FormState> {
  const values = form.getAll("value").map(String);
  return runAction((actor) =>
    setTripMembers(actor, text(form, "id"), {
      groupIds: values.filter((v) => v.startsWith("g:")).map((v) => v.slice(2)),
      userIds: values.filter((v) => v.startsWith("p:")).map((v) => v.slice(2)),
    }),
  );
}

export async function createLinkAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => createTripLink(actor, text(form, "id")));
}

export async function revokeLinkAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => revokeTripLink(actor, text(form, "id"), text(form, "linkId")));
}
