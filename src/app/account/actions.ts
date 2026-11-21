"use server";

import { runAction } from "@/lib/run-action";
import { setMyName } from "@/lib/account";
import type { FormState } from "@/components/ui/form-state";

export async function setMyNameAction(_: FormState, form: FormData): Promise<FormState> {
  return runAction(async (actor) => {
    await setMyName(actor, String(form.get("name") ?? ""));
  });
}
