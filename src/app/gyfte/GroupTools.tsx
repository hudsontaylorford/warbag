"use client";

import { useActionState, useState } from "react";
import { createGroupAction, createSampleAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/** Admin-only: start a group, or make the sample family to try things out. */
export function GroupTools({ hasSample }: { hasSample: boolean }) {
  const [open, setOpen] = useState(false);
  const [groupState, groupAction, creating] = useActionState(createGroupAction, {});
  const [sampleState, sampleAction, making] = useActionState(createSampleAction, {});

  return (
    <div className="flex flex-col gap-3">
      {open ? (
        <form action={groupAction} className="flex flex-col gap-3">
          <Field label="Group name" name="name" placeholder="Ford Family" required maxLength={80} autoComplete="off" />
          {groupState.error && <Alert>{groupState.error}</Alert>}
          <div className="flex gap-3">
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create group"}
            </Button>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-x-6">
          <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-button">
            New group
          </button>
          {!hasSample && (
            <form action={sampleAction}>
              <button type="submit" disabled={making} className="min-h-11 text-button disabled:opacity-50">
                {making ? "Making sample family…" : "Try a sample family"}
              </button>
            </form>
          )}
        </div>
      )}
      {sampleState.error && <Alert>{sampleState.error}</Alert>}
    </div>
  );
}
