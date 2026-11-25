"use client";

import Link from "next/link";
import { useActionState, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { COLOUR_LABEL, COLOURS, IMPORTANCE_LABEL, toggleMark, type Note, type NoteFields } from "@/lib/jot/note";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { trashNoteAction } from "./actions";
import { tint } from "./NoteCard";
import { useNoteSaver, type SaveState } from "./useNoteSaver";
import { toLocalInput, useNow, whenLabel } from "./useNow";

const LABEL_ORDER = ["none", "important", "urgent", "later"] as const;

function Status({ state, isNew, retry }: { state: SaveState; isNew: boolean; retry: () => void }) {
  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Alert>{state.error}</Alert>
        <button type="button" onClick={retry} className="min-h-11 text-sm text-button">
          Try again
        </button>
      </div>
    );
  }
  const text = isNew
    ? "Saved to your notes once you start typing."
    : state.kind === "saved"
      ? "Saved ✓"
      : state.kind === "saving"
        ? "Saving…"
        : "Not saved yet";
  return (
    <p role="status" className="min-h-6 text-sm text-soft">
      {text}
    </p>
  );
}

function TrashForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(trashNoteAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="max-w-xs">
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? "Moving…" : "Move to Trash"}
        </Button>
      </div>
      <p className="text-sm text-soft">It stays in the Trash for 30 days, and you can restore it from there.</p>
      {!pending && state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

function Reminder({ fields, update, email }: { fields: NoteFields; update: (c: Partial<NoteFields>, now?: boolean) => void; email: string }) {
  const now = useNow();
  const [draft, setDraft] = useState<string | null>(null);
  if (now === null) return <div className="min-h-24" />;
  const value = draft ?? (fields.remindAt ? toLocalInput(fields.remindAt) : "");
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-semibold">Reminder</legend>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm">When</span>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            const t = v ? Date.parse(v) : NaN;
            if (!Number.isNaN(t)) update({ remindAt: new Date(t).toISOString() }, true);
          }}
          onBlur={() => setDraft(null)}
          className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
      </label>
      {fields.remindAt && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm">How</span>
            <select
              value={fields.remindBy === "none" ? "none" : "email"}
              onChange={(e) => update({ remindBy: e.target.value === "none" ? "none" : "email" }, true)}
              className="min-h-12 rounded-[var(--radius-control)] border border-line bg-field px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              <option value="email">Email me</option>
              <option value="none">Only show it on the note</option>
            </select>
          </label>
          <p className="text-sm text-soft">
            {Date.parse(fields.remindAt) <= now
              ? "That time has passed. Pick a later time to be reminded again."
              : fields.remindBy === "email"
                ? `An email goes to ${email} at ${whenLabel(fields.remindAt, now)}.`
                : `The note turns red at ${whenLabel(fields.remindAt, now)}. Nothing is sent.`}
          </p>
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              update({ remindAt: null }, true);
            }}
            className="min-h-11 self-start text-sm text-button"
          >
            No reminder
          </button>
        </>
      )}
    </fieldset>
  );
}

/**
 * Writing a note: the text first, then its colour, label and reminder.
 * Everything saves by itself. `note` is null for a new note.
 */
export function Editor({ note, email }: { note: Note | null; email: string }) {
  const router = useRouter();
  const initial: NoteFields = note
    ? { body: note.body, colour: note.colour, importance: note.importance, remindAt: note.remindAt, remindBy: note.remindBy }
    : { body: "", colour: "yellow", importance: "none", remindAt: null, remindBy: "email" };
  const { id, fields, update, state, retry, flush } = useNoteSaver(note?.id ?? null, initial);
  const isNew = !id && !fields.body.trim();

  // Cmd/Ctrl+B and +I: bold and italic around the selection.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.metaKey || e.ctrlKey) || (e.key !== "b" && e.key !== "i")) return;
    e.preventDefault();
    const el = e.currentTarget;
    const r = toggleMark(el.value, el.selectionStart, el.selectionEnd, e.key === "b" ? "**" : "*");
    update({ body: r.text });
    requestAnimationFrame(() => el.setSelectionRange(r.start, r.end));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/jot"
          onClick={async (e) => {
            // Finish saving first, so the board shows this note as it is now.
            e.preventDefault();
            await flush();
            router.push("/jot");
          }}
          className="min-h-11 content-center self-start text-accent underline-offset-4 hover:underline"
        >
          ‹ Notes
        </Link>
        <h1 className="sr-only">{note ? "Note" : "New note"}</h1>
        <textarea
          aria-label="Note"
          value={fields.body}
          autoFocus={!note}
          onChange={(e) => update({ body: e.target.value })}
          onBlur={() => void flush()}
          onKeyDown={onKeyDown}
          rows={10}
          maxLength={20000}
          placeholder="Write something…"
          className={`min-h-[45vh] w-full resize-y rounded-[var(--radius-control)] p-4 text-base leading-relaxed text-ink placeholder:text-soft ${tint[fields.colour]} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
        />
        <Status state={state} isNew={isNew} retry={retry} />
        <p className="text-sm text-soft">
          Use **bold**, *italic*, and - at the start of a line for a list.
        </p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {COLOURS.map((c) => (
            <label key={c} className="relative cursor-pointer">
              <input type="radio" name="colour" value={c} checked={fields.colour === c} onChange={() => update({ colour: c }, true)} className="peer sr-only" />
              <span className={`flex size-11 rounded-full border border-ink/25 ${tint[c]} peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-checked:ring-offset-page peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent`} />
              <span className="sr-only">{COLOUR_LABEL[c]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Label</legend>
        <div className="flex flex-wrap gap-2">
          {LABEL_ORDER.map((k) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="importance" value={k} checked={fields.importance === k} onChange={() => update({ importance: k }, true)} className="peer sr-only" />
              <span className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-ink/40 px-4 text-sm font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-page peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                {k === "none" ? "None" : IMPORTANCE_LABEL[k]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Reminder fields={fields} update={update} email={email} />

      {id && (
        <div className="border-t border-line pt-6">
          <TrashForm id={id} />
        </div>
      )}
    </div>
  );
}
