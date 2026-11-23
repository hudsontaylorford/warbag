"use server";

import { redirect } from "next/navigation";
import { deleteGroup } from "@/lib/access";
import { runAction } from "@/lib/run-action";
import {
  InputError,
  invitePerson,
  newGroup,
  setPeopleManager,
  removePerson,
  renameGroup,
  renamePerson,
  setGroupApps,
  setGroupMembers,
  setPersonApps,
  setPersonGroups,
} from "@/lib/people";

import type { FormState } from "@/components/ui/form-state";

const run = (work: Parameters<typeof runAction>[0]) => runAction(work, "You can't do that here. Admins and people managers have different limits.");

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
    id = await newGroup(actor, name);
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

export async function setPeopleManagerAction(_: FormState, form: FormData): Promise<FormState> {
  return run((actor) => setPeopleManager(actor, text(form, "id"), form.getAll("value").includes("on")));
}
