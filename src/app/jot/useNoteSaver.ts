"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteFields } from "@/lib/jot/note";
import { createNoteAction, saveNoteAction } from "./actions";

export type SaveState = { kind: "saved" | "saving" | "unsaved" | "error"; error?: string };

/**
 * Keeps the server copy of a note in step with the page. A new note isn't
 * made until it has some text, then gets its own address. Changes are sent
 * whole, one save at a time, a moment after typing stops (or right away).
 * "Saved" shows only once the server confirms; a failed save keeps the
 * change on the page with Try again.
 */
export function useNoteSaver(initialId: string | null, initial: NoteFields) {
  const [fields, setFields] = useState(initial);
  const [id, setId] = useState(initialId);
  const [state, setState] = useState<SaveState>({ kind: "saved" });
  const latest = useRef(initial);
  const idRef = useRef(initialId);
  const dirty = useRef(false);
  const busy = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (busy.current) return;
    busy.current = true;
    while (dirty.current) {
      // A new note waits for its first words.
      if (!idRef.current && !latest.current.body.trim()) break;
      dirty.current = false;
      setState({ kind: "saving" });
      let error: string | undefined;
      try {
        if (idRef.current) {
          error = (await saveNoteAction(idRef.current, latest.current)).error;
        } else {
          const r = await createNoteAction(latest.current);
          error = r.error;
          if (r.id) {
            idRef.current = r.id;
            setId(r.id);
            // The note has an address now: reloading or going back finds it.
            window.history.replaceState(null, "", `/jot/${r.id}`);
          }
        }
      } catch {
        error = "Not saved. Check your connection, then tap Try again.";
      }
      if (error) {
        dirty.current = true;
        busy.current = false;
        setState({ kind: "error", error });
        return;
      }
    }
    busy.current = false;
    setState(dirty.current ? { kind: "unsaved" } : { kind: "saved" });
  }, []);

  const update = useCallback(
    (change: Partial<NoteFields>, now = false) => {
      const next = { ...latest.current, ...change };
      latest.current = next;
      setFields(next);
      dirty.current = true;
      setState((st) => (st.kind === "saving" ? st : { kind: "unsaved" }));
      window.clearTimeout(timer.current);
      if (now) void flush();
      else timer.current = window.setTimeout(() => void flush(), 600);
    },
    [flush],
  );

  // Don't lose an edit when leaving the page.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if ((dirty.current && (idRef.current || latest.current.body.trim())) || busy.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return { id, fields, update, state, retry: flush, flush };
}
