"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { AccessDenied, createGroup, deleteGroup } from "@/lib/access";
import {
  InputError,
  invitePerson,
  removePerson,
  renameGroup,
  renamePerson,
  setGroupApps,
  setGroupMembers,
  setPersonApps,
  setPersonGroups,
} from "@/lib/people";
import { currentActor } from "@/lib/session";

import type { FormState } from "@/components/ui/form-state";

/**
 * Every admin action: signed-in check, then the library call (which checks
 * admin itself), then a plain message for the screen. Inputs are only ids
 * and the requested change; everything else is re-read on the server.
 */
async function run(work: (actor: { id: string; isAdmin: boolean }) => Promise<string | void>): Promise<FormState> {
  const actor = await currentActor();
  if (!actor) return { error: "You're signed out. Sign in again, then retry." };
  try {
    const message = await work(actor);
    refresh();
    return { ok: true, message: message || "Saved" };
  } catch (err) {
    if (err instanceof InputError) return { error: err.message };
    if (err instanceof AccessDenied) return { error: "Only admins can do this." };
    console.error("admin action failed", err);
    return { error: "Something went wrong and nothing was saved. Try again." };
  }
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const list = (form: FormData, key: string) => form.getAll(key).map(String);

export async function inviteAction(_: FormState, form: FormData): Promise<FormState> {
  return run(async (actor) => {
    const email = text(form, "email");
    const result = await invitePerson(actor, {
      email,
      name: text(form, "name"),
      sendEmail: form.get("sendEmail") === "on",
    });
    const who = email.trim().toLowerCase();
    if (!result.created) return result.emailed ? `${who} is already here. Sign-in steps sent again.` : `${who} is already here.`;
    return result.emailed ? `Invited ${who}. They've been emailed how to sign in.` : `Added ${who}. Tell them to sign in at warbag.rodeo.`;
  });
}

export async function renamePersonAction(_: FormState, form: FormData): Promise<FormState> {
  return run((actor) => renamePerson(actor, text(form, "id"), text(form, "name")));
}

export async function setPersonAppsAction(_: FormState, form: FormData): Promise<FormState> {
  return run((actor) => setPersonApps(actor, text(form, "id"), list(form, "value")));
}

export async function setPersonGroupsAction(_: FormState, form: FormData): Promise<FormState> {
  return run((actor) => setPersonGroups(actor, text(form, "id"), list(form, "value")));
}

export async function removePersonAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await run((actor) => removePerson(actor, text(form, "id")));
  if (state.ok) redirect("/admin");
  return state;
}

export async function createGroupAction(_: FormState, form: FormData): Promise<FormState> {
  let id = "";
  const state = await run(async (actor) => {
    const name = text(form, "name").trim();
    if (!name) throw new InputError("Give the group a name.");
    id = await createGroup(actor, name);
  });
  if (state.ok) redirect(`/admin/groups/${id}`);
  return state;
}

export async function renameGroupAction(_: FormState, form: FormData): Promise<FormState> {
  return run((actor) => renameGroup(actor, text(form, "id"), text(form, "name")));
}

export async function setGroupMembersAction(_: FormState, form: FormData): Promise<FormState> {
  return run((actor) => setGroupMembers(actor, text(form, "id"), list(form, "value")));
}

export async function setGroupAppsAction(_: FormState, form: FormData): Promise<FormState> {
  return run((actor) => setGroupApps(actor, text(form, "id"), list(form, "value")));
}

export async function deleteGroupAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await run((actor) => deleteGroup(actor, text(form, "id")));
  if (state.ok) redirect("/admin");
  return state;
}
