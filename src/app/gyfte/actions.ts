"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/run-action";
import type { FormState } from "@/components/ui/form-state";
import {
  addItem,
  addItems,
  bringForward,
  createList,
  deleteItem,
  deleteList,
  setReceived,
  setStarred,
  updateItem,
  updateList,
} from "@/lib/gyfte/data";
import { claimItem, dismissClaim, unclaimItem } from "@/lib/gyfte/claims";
import { createListLink, revokeListLink, setSharing, shareLikeLast } from "@/lib/gyfte/sharing";

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
    updateList(actor, text(form, "id"), {
      recipientName: text(form, "recipientName"),
      date: text(form, "date"),
      claimsMode: text(form, "claimsMode") || undefined,
    }),
  );
}

export async function deleteListAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await runAction((actor) => deleteList(actor, text(form, "id")));
  if (state.ok) redirect("/gyfte");
  return state;
}

export async function claimAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await claimItem(actor, text(form, "id"));
    return "You're getting this";
  });
}

export async function unclaimAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await unclaimItem(actor, text(form, "id"));
    return "Claim undone";
  });
}

export async function dismissClaimAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => dismissClaim(actor, text(form, "id")));
}

export async function setSharingAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) =>
    setSharing(actor, text(form, "id"), {
      groupIds: form.getAll("group").map(String),
      userIds: form.getAll("person").map(String),
      editorIds: form.getAll("editor").map(String),
    }),
  );
}

export async function shareLikeLastAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await shareLikeLast(actor, text(form, "id"));
    return "Shared";
  });
}

export async function createLinkAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await createListLink(actor, text(form, "id"));
    return "Link ready";
  });
}

export async function revokeLinkAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await revokeListLink(actor, text(form, "id"), text(form, "linkId"));
    return "Link turned off";
  });
}

export async function addItemsAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    const skip = form.getAll("skip").map(Number).filter(Number.isInteger);
    const n = await addItems(actor, text(form, "id"), text(form, "text"), skip);
    return n === 1 ? "Added 1 gift" : `Added ${n} gifts`;
  });
}
