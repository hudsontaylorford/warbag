"use client";

import { useActionState, useRef, useState } from "react";
import { addStopAction } from "./actions";
import { Alert } from "@/components/ui/Alert";
import { StopFields } from "./StopFields";
import { useEditor } from "./editing";

/** One box to add a stop or idea; time, place and the rest are optional. */
export function QuickAdd({
  tripId,
  day,
  label,
  placeholder,
  autoFocus,
  trackDetails = false,
}: {
  tripId: string;
  day?: string;
  label: string;
  placeholder: string;
  /** Focus the box when it appears after a tap (the day card's "Add to this day"). */
  autoFocus?: boolean;
  /** Count the extra details as an open editor (the always-visible add box on Ideas). */
  trackDetails?: boolean;
}) {
  // On Ideas the add box is always there, so its extra details (time, place,
  // notes...) count as an open editor: one at a time on the page. Inside a
  // day card the add box itself is the editor, so details stay local.
  const details = useEditor(`details:${day ?? "idea"}`);
  const [localMore, setLocalMore] = useState(false);
  const more = trackDetails ? details.open : localMore;
  const setMore = (on: boolean) => (trackDetails ? (on ? details.request() : details.close()) : setLocalMore(on));
  const formRef = useRef<HTMLFormElement>(null);
  // Pasting a link into the box files it as the link and asks what it is.
  const [pastedLink, setPastedLink] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(async (prev: Parameters<typeof addStopAction>[0], form: FormData) => {
    const next = await addStopAction(prev, form);
    if (next.ok) {
      formRef.current?.reset();
      setMore(false);
      setPastedLink(null);
    }
    return next;
  }, {});
  const id = `add-${day ?? "idea"}`;
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").trim();
    if (e.currentTarget.value.trim() !== "" || !/^https?:\/\/\S+$/i.test(text)) return;
    e.preventDefault();
    const linkBox = formRef.current?.elements.namedItem("link");
    if (linkBox instanceof HTMLInputElement) linkBox.value = text;
    setPastedLink(text);
    setMore(true);
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={tripId} />
      {day && <input type="hidden" name="day" value={day} />}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name="title"
          required
          maxLength={200}
          autoComplete="off"
          autoFocus={autoFocus}
          onPaste={onPaste}
          placeholder={pastedLink ? "What is it?" : placeholder}
          aria-describedby={pastedLink ? `${id}-pasted` : undefined}
          className="min-h-12 min-w-0 flex-1 rounded-[var(--radius-control)] border border-line bg-field px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 shrink-0 rounded-[var(--radius-control)] bg-ink px-4 font-semibold text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {pastedLink && (
        <p id={`${id}-pasted`} className="text-sm text-soft">
          Link added below. Now say what it is.
        </p>
      )}
      {more ? (
        <StopFields link={pastedLink ?? undefined} />
      ) : (
        <button type="button" onClick={() => setMore(true)} className="min-h-11 self-start px-1 text-sm text-accent underline-offset-4 hover:underline">
          Add a time, place, meal or link
        </button>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && !pending && state.message !== "Added" && (
        <p role="status" className="text-sm text-soft">
          {state.message} ✓
        </p>
      )}
    </form>
  );
}
