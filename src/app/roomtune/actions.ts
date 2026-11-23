"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/run-action";
import type { FormState } from "@/components/ui/form-state";
import { currentActor } from "@/lib/session";
import { AccessDenied } from "@/lib/access";
import { InputError } from "@/lib/errors";
import {
  createSetup,
  createSetupLink,
  deleteSetup,
  importSetups,
  revokeSetupLink,
  saveSetup,
} from "@/lib/roomtune/setups";
import { readEqScreenshot, type EqDraft } from "@/lib/roomtune/eq-ai";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Runs work for the signed-in person and turns the outcome into a plain message. No page refresh. */
async function quiet<T>(work: (actor: NonNullable<Awaited<ReturnType<typeof currentActor>>>) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "You're signed out. Sign in again, then retry." };
  try {
    return { ok: true, value: await work(actor) };
  } catch (err) {
    if (err instanceof InputError) return { ok: false, error: err.message };
    if (err instanceof AccessDenied) return { ok: false, error: "This setup isn't available to you any more." };
    console.error("roomtune action failed", err);
    return { ok: false, error: "Something went wrong and nothing was saved. Try again." };
  }
}

/** Creates a setup and returns its id, so the page can open it. */
export async function createSetupAction(doc: unknown): Promise<{ id?: string; error?: string }> {
  const r = await quiet((actor) => createSetup(actor, doc));
  return r.ok ? { id: r.value } : { error: r.error };
}

/** Saves the whole setup. The page keeps its own copy, so nothing is re-rendered. */
export async function saveSetupAction(id: string, doc: unknown): Promise<{ ok?: boolean; error?: string }> {
  const r = await quiet((actor) => saveSetup(actor, id, doc));
  return r.ok ? { ok: true } : { error: r.error };
}

export async function deleteSetupAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await runAction((actor) => deleteSetup(actor, text(form, "id")));
  if (state.ok) redirect("/roomtune");
  return state;
}

export async function importSetupsAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new InputError("Pick the .json file to import.");
    if (file.size > 900_000) throw new InputError("That file is too big to be a Room Tuner export.");
    const n = await importSetups(actor, await file.text());
    return n === 1 ? "Imported 1 setup" : `Imported ${n} setups`;
  });
}

export async function createLinkAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await createSetupLink(actor, text(form, "id"));
    return "View link made";
  });
}

export async function revokeLinkAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await revokeSetupLink(actor, text(form, "id"), text(form, "linkId"));
    return "View link turned off";
  });
}

/** Reads an EQ screenshot for the setup form. The image isn't kept. */
export async function readEqAction(form: FormData): Promise<{ draft?: EqDraft; error?: string }> {
  const file = form.get("image");
  if (!(file instanceof File)) return { error: "Choose a screenshot of the EQ screen." };
  const r = await quiet(async (actor) => readEqScreenshot(actor, Buffer.from(await file.arrayBuffer())));
  return r.ok ? { draft: r.value } : { error: r.error };
}
