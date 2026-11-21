"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/run-action";
import type { FormState } from "@/components/ui/form-state";
import {
  addItem,
  bringForward,
  createList,
  deleteItem,
  deleteList,
  setReceived,
  setStarred,
  updateItem,
  updateList,
} from "@/lib/gyfte/data";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function createListAction(_: FormState, form: FormData): Promise<FormState> {
  let id = "";
  const state = await runAction(async (actor) => {
    id = await createList(actor, {
      forMe: text(form, "for") !== "other",
      recipientName: text(form, "recipientName"),
      occasion: text(form, "occasion"),
      date: text(form, "date"),
    });
  });
  if (state.ok) redirect(`/gyfte/${id}`);
  return state;
}

export async function addItemAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await addItem(actor, text(form, "id"), text(form, "text"));
    return "Added";
  });
}

export async function updateItemAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) =>
    updateItem(actor, text(form, "id"), {
      name: text(form, "name"),
      notes: text(form, "notes"),
      size: text(form, "size"),
      color: text(form, "color"),
      price: text(form, "price"),
      links: form.getAll("links").map(String),
    }),
  );
}

export async function setStarredAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => setStarred(actor, text(form, "id"), text(form, "starred") === "true"));
}

export async function setReceivedAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => setReceived(actor, text(form, "id"), text(form, "received") === "true"));
}

export async function deleteItemAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await deleteItem(actor, text(form, "id"));
    return "Deleted";
  });
}

export async function bringForwardAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    const n = await bringForward(actor, text(form, "id"), form.getAll("value").map(String));
    return n === 1 ? "Brought 1 gift forward" : `Brought ${n} gifts forward`;
  });
}

export async function updateListAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) =>
    updateList(actor, text(form, "id"), { recipientName: text(form, "recipientName"), date: text(form, "date") }),
  );
}

export async function deleteListAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await runAction((actor) => deleteList(actor, text(form, "id")));
  if (state.ok) redirect("/gyfte");
  return state;
}
