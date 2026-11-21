"use client";

import { useActionState, useState } from "react";
import type { Item } from "@/lib/gyfte/data";
import { deleteItemAction, setReceivedAction, setStarredAction, updateItemAction } from "../actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-xl " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";

/** One gift: name (opens its link), details line, star, and More for editing. */
export function ItemRow({ item, store, canEdit }: { item: Item; store: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [starState, starAction, starPending] = useActionState(setStarredAction, {});
  const details = [item.size, item.color, item.price, store].filter(Boolean).join(" · ");
  const received = item.receivedAt !== null;

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          {item.links[0] ? (
            <a
              href={item.links[0]}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-semibold break-words text-accent underline-offset-4 hover:underline"
            >
              {item.name}
              <span className="sr-only"> (opens {store} in a new tab)</span>
            </a>
          ) : (
            <span className="font-semibold break-words">{item.name}</span>
          )}
          {details && <span className="text-sm text-soft break-words">{details}</span>}
          {item.notes && <span className="text-sm break-words whitespace-pre-line">{item.notes}</span>}
        </div>

        {canEdit ? (
          <form action={starAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="starred" value={String(!item.starred)} />
            <button
              type="submit"
              disabled={starPending}
              aria-pressed={item.starred}
              aria-label="Most wanted"
              title="Most wanted"
              className={`${iconButton} ${item.starred ? "text-ink" : "text-soft"}`}
            >
              {item.starred ? "★" : "☆"}
            </button>
          </form>
        ) : (
          item.starred && (
            <span className={`${iconButton} text-ink`} aria-label="Most wanted" role="img">
              ★
            </span>
          )
        )}

        {canEdit && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="min-h-11 shrink-0 px-2 text-sm text-accent underline-offset-4 hover:underline"
          >
            {open ? "Close" : "More"}
          </button>
        )}
      </div>
      {starState.error && <Alert>{starState.error}</Alert>}

      {canEdit && open && <EditItem item={item} received={received} onDone={() => setOpen(false)} />}
    </div>
  );
}

function EditItem({ item, received, onDone }: { item: Item; received: boolean; onDone: () => void }) {
  const [saveState, saveAction, saving] = useActionState(updateItemAction, {});
  const [gotState, gotAction, gotPending] = useActionState(setReceivedAction, {});
  const [delState, delAction, deleting] = useActionState(deleteItemAction, {});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const links = [...item.links, ""].slice(0, 5);

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-wash p-4">
      <form action={saveAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={item.id} />
        <Field label="Name" name="name" defaultValue={item.name} required maxLength={200} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Size" name="size" defaultValue={item.size} maxLength={80} />
          <Field label="Color" name="color" defaultValue={item.color} maxLength={80} />
        </div>
        <Field label="Price" name="price" defaultValue={item.price} maxLength={40} placeholder="$40, under $30…" />
        {links.map((link, i) => (
          <Field
            key={i}
            label={i === 0 ? "Link" : `Link ${i + 1}`}
            name="links"
            defaultValue={link}
            inputMode="url"
            placeholder="https://"
          />
        ))}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`notes-${item.id}`} className="text-sm font-semibold">
            Notes
          </label>
          <textarea
            id={`notes-${item.id}`}
            name="notes"
            defaultValue={item.notes}
            maxLength={1000}
            rows={3}
            className="rounded-lg border border-line bg-page px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
        </div>
        {saveState.error && <Alert>{saveState.error}</Alert>}
        {saveState.ok && !saving && (
          <p role="status" className="text-sm text-soft">
            Saved ✓
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="quiet" onClick={onDone}>
            Close
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
        <form action={gotAction} className="flex-1">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="received" value={String(!received)} />
          <Button type="submit" variant="quiet" disabled={gotPending}>
            {received ? "Move back to the list" : "Got it"}
          </Button>
        </form>
        {!confirmDelete ? (
          <div className="flex-1">
            <Button variant="quiet" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        ) : (
          <form action={delAction} className="flex w-full flex-col gap-3">
            <input type="hidden" name="id" value={item.id} />
            <p className="text-sm">Delete {item.name}? This can&apos;t be undone.</p>
            <div className="flex gap-3">
              <Button type="submit" variant="danger" disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, delete"}
              </Button>
              <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
      {gotState.error && <Alert>{gotState.error}</Alert>}
      {delState.error && <Alert>{delState.error}</Alert>}
    </div>
  );
}
