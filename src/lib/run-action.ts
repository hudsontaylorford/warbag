import "server-only";
import { refresh } from "next/cache";
import { AccessDenied, type Actor } from "./access";
import { InputError } from "./errors";
import { currentActor } from "./session";
import type { FormState } from "@/components/ui/form-state";

/**
 * The shape of every server action: check someone is signed in, do the
 * work (the library checks what they may do), refresh the page, and turn
 * the outcome into a plain message for the form.
 */
export async function runAction(
  work: (actor: Actor) => Promise<string | void>,
  refused = "You don't have access to that.",
): Promise<FormState> {
  const actor = await currentActor();
  if (!actor) return { error: "You're signed out. Sign in again, then retry." };
  try {
    const message = await work(actor);
    refresh();
    return { ok: true, message: message || "Saved" };
  } catch (err) {
    if (err instanceof InputError) return { error: err.message };
    if (err instanceof AccessDenied) return { error: refused };
    console.error("action failed", err);
    return { error: "Something went wrong and nothing was saved. Try again." };
  }
}
