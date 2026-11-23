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
  setAttendance,
  createChoice,
  moveStop,
  setStopChoice,
  ungroupChoice,
  setDayInfo,
  setTripMembers,
  setTripOrganizers,
  updateStop,
  updateTrip,
} from "@/lib/mosey/trips";
import {
  addExpense,
  addPayment,
  addPerson,
  deleteExpense,
  deletePayment,
  freezeStatement,
  removePerson,
  setSettle,
  updateExpense,
  updatePerson,
} from "@/lib/mosey/ledger";
import { discardReceipt, uploadReceipt, type UploadResult } from "@/lib/mosey/receipts";
import { currentActor } from "@/lib/session";
import { AccessDenied } from "@/lib/access";
import { InputError } from "@/lib/errors";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const stopFields = (form: FormData) => ({
  title: text(form, "title"),
  time: text(form, "time"),
  place: text(form, "place"),
  link: text(form, "link"),
  notes: text(form, "notes"),
  membersOnly: form.get("membersOnly") === "on",
  status: text(form, "status"),
  meal: text(form, "meal"),
  handledBy: text(form, "handledBy"),
  askWho: form.get("askWho") === "on",
});
const tripFields = (form: FormData) => ({
  name: text(form, "name"),
  place: text(form, "place"),
  start: text(form, "start"),
  end: text(form, "end"),
});

/** Moves a stop one place up or down in its day. Organizers only. */
export async function moveStopAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await moveStop(actor, text(form, "id"), text(form, "direction") === "up" ? "up" : "down");
    return "Moved";
  });
}

/** A choice between options on a day. Organizers only. */
export async function createChoiceAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await createChoice(actor, text(form, "id"), { day: text(form, "day"), title: text(form, "title"), options: form.getAll("option").map(String), time: text(form, "time") });
    return "Added";
  });
}

export async function setStopChoiceAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await setStopChoice(actor, text(form, "id"), text(form, "choice") || null);
    return "Saved";
  });
}

export async function ungroupChoiceAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await ungroupChoice(actor, text(form, "id"), text(form, "choice"));
    return "Ungrouped";
  });
}

/** Going, maybe, or not set, for one person and one stop. */
export async function setAttendanceAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    const state = text(form, "state");
    await setAttendance(actor, text(form, "id"), text(form, "person"), state === "going" || state === "maybe" ? state : null);
    return "Saved";
  });
}

/** A day's area and tag. Organizers only. */
export async function setDayAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await setDayInfo(actor, text(form, "id"), text(form, "day"), { area: text(form, "area"), tag: text(form, "tag") });
    return "Saved";
  });
}

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

export async function setOrganizersAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => setTripOrganizers(actor, text(form, "id"), form.getAll("value").map(String)));
}

export async function createLinkAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => createTripLink(actor, text(form, "id")));
}

export async function revokeLinkAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => revokeTripLink(actor, text(form, "id"), text(form, "linkId")));
}

// ------------------------------------------------------------ money


const expenseFields = (form: FormData) => ({
  description: text(form, "description"),
  amount: text(form, "amount"),
  spentOn: text(form, "spentOn"),
  paidBy: text(form, "paidBy"),
  participants: form.getAll("participants").map(String),
  notes: text(form, "notes"),
});

export async function addExpenseAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await addExpense(actor, text(form, "id"), { ...expenseFields(form), receiptId: text(form, "receiptId") || undefined });
    return "Added";
  });
}

export type ReceiptState = (UploadResult & { error?: undefined }) | { error: string };

/** Stores a receipt photo and returns the AI's suggestion for a person to review. Saves no expense. */
export async function uploadReceiptAction(form: FormData): Promise<ReceiptState> {
  const actor = await currentActor();
  if (!actor) return { error: "You're signed out. Sign in again, then retry." };
  const file = form.get("photo");
  if (!(file instanceof File)) return { error: "Choose a photo of the receipt." };
  try {
    return await uploadReceipt(actor, text(form, "id"), Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    if (err instanceof InputError) return { error: err.message };
    if (err instanceof AccessDenied) return { error: "You don't have access to that." };
    console.error("receipt upload failed", err);
    return { error: "Couldn't save the photo. Try again, or add the expense by hand." };
  }
}

/** Deletes a receipt photo that was never saved as an expense. */
export async function discardReceiptAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await discardReceipt(actor, text(form, "receiptId"));
    return "Photo discarded";
  });
}

export async function updateExpenseAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => updateExpense(actor, text(form, "id"), expenseFields(form)));
}

export async function deleteExpenseAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => deleteExpense(actor, text(form, "id")));
}

export async function addPaymentAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await addPayment(actor, text(form, "id"), {
      from: text(form, "from"),
      to: text(form, "to"),
      amount: text(form, "amount"),
      paidOn: text(form, "paidOn"),
      note: text(form, "note"),
    });
    return "Recorded";
  });
}

export async function deletePaymentAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => deletePayment(actor, text(form, "id")));
}

export async function addPersonAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await addPerson(actor, text(form, "id"), { name: text(form, "name"), userId: text(form, "userId"), household: text(form, "household"), kid: form.get("kid") === "on" });
    return "Added";
  });
}

export async function updatePersonAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) =>
    updatePerson(actor, text(form, "id"), text(form, "personId"), {
      name: text(form, "name"),
      userId: text(form, "userId"),
      household: text(form, "household"),
      kid: form.get("kid") === "on",
    }),
  );
}

export async function removePersonAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => removePerson(actor, text(form, "id"), text(form, "personId")));
}

export async function setSettleAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => setSettle(actor, text(form, "id"), text(form, "mode"), text(form, "hub") || null));
}

export async function freezeAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    const v = await freezeStatement(actor, text(form, "id"));
    return `Saved as version ${v}`;
  });
}
