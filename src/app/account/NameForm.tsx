"use client";

import { useActionState, useState } from "react";
import { setMyNameAction } from "./actions";
import { Field } from "@/components/ui/Field";
import { SaveStatus, useAutosave } from "@/components/ui/forms";

/** Your name: saves itself when you leave the field or press Return. */
export function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(setMyNameAction, {});
  const [saved, setSaved] = useState(name);
  const { ref: autoRef, saveNow: autoSaveNow } = useAutosave();
  return (
    <form
      ref={autoRef}
      action={(form) => {
        setSaved(String(form.get("name") ?? ""));
        return formAction(form);
      }}
      className="flex flex-col gap-1"
    >
      <Field
        label="Your name"
        name="name"
        defaultValue={name}
        required
        maxLength={80}
        autoComplete="given-name"
        enterKeyHint="done"
        hint="What family and friends see, like on your gift lists."
        onBlur={(e) => {
          if (e.currentTarget.value !== saved) autoSaveNow();
        }}
      />
      <SaveStatus state={state} pending={pending} />
    </form>
  );
}
