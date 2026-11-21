"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/run-action";
import { InputError } from "@/lib/errors";
import type { FormState } from "@/components/ui/form-state";
import {
  addItem,
  addItems,
  copyForward,
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
import { applyImportDraft, createImportDraft, discardImportDraft } from "@/lib/gyfte/imports";
import { createGyfteGroup, createSampleFamily, deleteSampleFamily, setFamilyLink, startMyGroupList } from "@/lib/gyfte/groups";
import { addKid, addKidParent, startKidList } from "@/lib/gyfte/kids";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
/** Set only by forms shown in Edit history mode. */
const hist = (form: FormData) => ({ history: form.get("history") === "1" });

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
    await addItem(actor, text(form, "id"), text(form, "text"), hist(form));
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
    }, hist(form)),
  );
}

export async function setStarredAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => setStarred(actor, text(form, "id"), text(form, "starred") === "true", hist(form)));
}

export async function setReceivedAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction((actor) => setReceived(actor, text(form, "id"), text(form, "received") === "true", hist(form)));
}

export async function deleteItemAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await deleteItem(actor, text(form, "id"), hist(form));
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
    }, hist(form)),
  );
}

export async function deleteListAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await runAction((actor) => deleteList(actor, text(form, "id"), hist(form)));
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
    const n = await addItems(actor, text(form, "id"), text(form, "text"), skip, hist(form));
    return n === 1 ? "Added 1 gift" : `Added ${n} gifts`;
  });
}

export async function uploadImportAction(_: FormState, form: FormData): Promise<FormState> {
  let id = "";
  const state = await runAction(async (actor) => {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new InputError("Choose a file first.");
    id = await createImportDraft(actor, file.name, await file.arrayBuffer());
  });
  if (state.ok) redirect(`/gyfte/import/${id}`);
  return state;
}

export async function applyImportAction(_: FormState, form: FormData): Promise<FormState> {
  let done = false;
  const state = await runAction(async (actor) => {
    const r = await applyImportDraft(actor, text(form, "id"), {
      keep: form.getAll("keep").map(String),
      me: text(form, "me") || null,
    });
    done = true;
    return `Imported ${r.lists} lists with ${r.gifts} gifts`;
  });
  if (done) redirect("/gyfte?imported=1");
  return state;
}

export async function discardImportAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await runAction((actor) => discardImportDraft(actor, text(form, "id")));
  if (state.ok) redirect("/gyfte/import");
  return state;
}

export async function copyForwardAction(_: FormState, form: FormData): Promise<FormState> {
  let target = "";
  const state = await runAction(async (actor) => {
    const r = await copyForward(actor, text(form, "id"), form.getAll("value").map(String));
    target = r.listId;
  });
  if (state.ok) redirect(`/gyfte/${target}`);
  return state;
}

export async function createGroupAction(_: FormState, form: FormData): Promise<FormState> {
  let id = "";
  const state = await runAction(async (actor) => {
    id = await createGyfteGroup(actor, text(form, "name"));
  }, "Only admins can create groups for now.");
  if (state.ok) redirect(`/gyfte/groups/${id}`);
  return state;
}

export async function createSampleAction(): Promise<FormState> {
  let id = "";
  const state = await runAction(async (actor) => {
    id = await createSampleFamily(actor);
  }, "Only admins can make the sample family.");
  if (state.ok) redirect(`/gyfte/groups/${id}`);
  return state;
}

export async function deleteSampleAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await runAction((actor) => deleteSampleFamily(actor, text(form, "id")));
  if (state.ok) redirect("/gyfte");
  return state;
}

export async function startMyGroupListAction(_: FormState, form: FormData): Promise<FormState> {
  let id = "";
  const state = await runAction(async (actor) => {
    id = await startMyGroupList(actor, text(form, "id"), text(form, "year"));
  });
  if (state.ok) redirect(`/gyfte/${id}`);
  return state;
}

export async function setFamilyLinkAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    const on = text(form, "on") === "1";
    await setFamilyLink(actor, text(form, "id"), on);
    return on ? "New link ready. Old links stop working." : "Family link turned off";
  }, "Only admins can manage the family link.");
}

export async function addKidAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await addKid(actor, text(form, "groupId"), text(form, "name"));
    return "Added";
  });
}

export async function addKidParentAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await addKidParent(actor, text(form, "kidId"), text(form, "userId"));
    return "Parent added";
  });
}

export async function startKidListAction(_: FormState, form: FormData): Promise<FormState> {
  let id = "";
  const state = await runAction(async (actor) => {
    id = await startKidList(actor, text(form, "groupId"), form.getAll("kidId").map(String), text(form, "year"));
  });
  if (state.ok) redirect(`/gyfte/${id}`);
  return state;
}
