"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/run-action";
import type { FormState } from "@/components/ui/form-state";
import { currentActor } from "@/lib/session";
import { AccessDenied } from "@/lib/access";
import { InputError } from "@/lib/errors";
import { createNote, emptyTrash, importStickies, moveNote, restoreNote, saveNote, trashNote } from "@/lib/jot/notes";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Runs work for the signed-in person and turns the outcome into a plain message. No page refresh. */
async function quiet<T>(work: (actor: NonNullable<Awaited<ReturnType<typeof currentActor>>>) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const actor = await currentActor();
  if (!actor) return { ok: false, error: "You're signed out. Sign in again, then retry." };
  try {
    return { ok: true, value: await work(actor) };
  } catch (err) {
    if (err instanceof InputError) return { ok: false, error: err.message };
    if (err instanceof AccessDenied) return { ok: false, error: "This note isn't available to you any more." };
    console.error("jot action failed", err);
    return { ok: false, error: "Something went wrong and nothing was saved. Try again." };
  }
}

/** Makes a note from what the page has so far and returns its id. */
export async function createNoteAction(fields: unknown): Promise<{ id?: string; error?: string }> {
  const r = await quiet((actor) => createNote(actor, fields));
  return r.ok ? { id: r.value } : { error: r.error };
}

/** Saves the whole note. The page keeps its own copy, so nothing is re-rendered. */
export async function saveNoteAction(id: string, fields: unknown): Promise<{ ok?: boolean; error?: string }> {
  const r = await quiet((actor) => saveNote(actor, id, fields));
  return r.ok ? { ok: true } : { error: r.error };
}

/** Moves a note to the Trash and goes back to the board. */
export async function trashNoteAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await runAction((actor) => trashNote(actor, text(form, "id")), "This note isn't available to you any more.");
  if (state.ok) redirect("/jot?trashed=1");
  return state;
}

export async function restoreNoteAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await restoreNote(actor, text(form, "id"));
    return "Restored to your notes";
  }, "This note isn't available to you any more.");
}

export async function emptyTrashAction(_: FormState, _form: FormData): Promise<FormState> {
  void _form;
  return runAction(async (actor) => {
    const n = await emptyTrash(actor);
    return n === 1 ? "Deleted 1 note" : `Deleted ${n} notes`;
  });
}

export async function moveNoteAction(_: FormState, form: FormData): Promise<FormState> {
  const direction = text(form, "direction") === "down" ? "down" : "up";
  return runAction((actor) => moveNote(actor, text(form, "id"), direction), "This note isn't available to you any more.");
}

export async function importStickiesAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new InputError("Pick the .json file to import.");
    if (file.size > 2_000_000) throw new InputError("That file is too big to be a Stickies notes file.");
    const r = await importStickies(actor, await file.text());
    const parts = [`${r.board} ${r.board === 1 ? "note" : "notes"}`];
    if (r.trash) parts.push(`${r.trash} to the Trash`);
    if (r.skipped) parts.push(`${r.skipped} skipped (deleted over 30 days ago)`);
    return `Imported ${parts.join(", ")}`;
  });
}
