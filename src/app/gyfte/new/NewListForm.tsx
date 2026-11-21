"use client";

import { useActionState, useState } from "react";
import { createListAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Choice } from "@/components/ui/Choice";

export function NewListForm({ myName, myBirthday }: { myName: string; myBirthday: string | null }) {
  const [state, formAction, pending] = useActionState(createListAction, {});
  const [forWhom, setForWhom] = useState<"me" | "other">("me");
  const [occasion, setOccasion] = useState<"christmas" | "birthday">("christmas");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Choice
        legend="Who is it for?"
        name="for"
        value={forWhom}
        onChange={(v) => setForWhom(v as "me" | "other")}
        options={[
          { value: "me", label: "Me" },
          { value: "other", label: "Someone without an account", hint: "A kid, for example. You manage it." },
        ]}
      />
      <Field
        key={forWhom}
        label={forWhom === "me" ? "Your name" : "Their name"}
        name="recipientName"
        defaultValue={forWhom === "me" ? myName : ""}
        required
        maxLength={80}
        autoComplete="off"
      />
      <Choice
        legend="Occasion"
        name="occasion"
        value={occasion}
        onChange={(v) => setOccasion(v as "christmas" | "birthday")}
        options={[
          { value: "christmas", label: "Christmas" },
          { value: "birthday", label: "Birthday" },
        ]}
      />
      {occasion === "birthday" && (
        <Field
          key={forWhom}
          label="Birthday"
          name="date"
          type="date"
          required
          defaultValue={forWhom === "me" ? (myBirthday ?? "") : ""}
        />
      )}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="max-w-xs">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create list"}
        </Button>
      </div>
    </form>
  );
}
