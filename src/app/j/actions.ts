"use server";

import { headers } from "next/headers";
import { InputError } from "@/lib/errors";
import { sendThisIsMe } from "@/lib/gyfte/groups";
import { requestToJoin } from "@/lib/gyfte/join";
import type { FormState } from "@/components/ui/form-state";

/** "This is me" on a family link. No sign-in needed; it only sends an email. */
export async function thisIsMeAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { name } = await sendThisIsMe(
      String(form.get("token") ?? ""),
      String(form.get("userId") ?? ""),
      await headers(),
      String(form.get("from") ?? ""),
    );
    return { ok: true, message: `We emailed ${name} a sign-in link. Open it on this phone.` };
  } catch (err) {
    if (err instanceof InputError) return { error: err.message };
    console.error("this-is-me failed", err);
    return { error: "Couldn't send the email. Try again in a minute." };
  }
}

/** "Ask to join" on a family link. No sign-in; an admin approves before anything is created. */
export async function askToJoinAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await requestToJoin(String(form.get("token") ?? ""), {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof InputError) return { error: err.message };
    console.error("ask-to-join failed", err);
    return { error: "Couldn't send your request. Try again in a minute." };
  }
}
