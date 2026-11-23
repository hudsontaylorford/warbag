"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Setup } from "@/lib/roomtune/setup";
import { saveSetupAction } from "./actions";

export type SaveState = { kind: "saved" | "saving" | "unsaved" | "error"; error?: string };

/**
 * Keeps the server copy of a setup in step with the page. Changes are sent
 * whole, one save at a time, after a short pause (or right away for
 * actions like deleting a round). "Saved" shows only after the server
 * confirms. On failure the page keeps the changes and offers a retry.
 */
export function useSaver(initial: Setup) {
  const [setup, setSetup] = useState(initial);
  const [state, setState] = useState<SaveState>({ kind: "saved" });
  const latest = useRef(initial);
  const dirty = useRef(false);
  const busy = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (busy.current) return;
    busy.current = true;
    // Keep going while edits arrive during a save, one save at a time.
    while (dirty.current) {
      dirty.current = false;
      setState({ kind: "saving" });
      const { id, ...doc } = latest.current;
      let r: { ok?: boolean; error?: string };
      try {
        r = await saveSetupAction(id, doc);
      } catch {
        r = { error: "Not saved. Check your connection, then tap Try again." };
      }
      if (r.error) {
        dirty.current = true;
        busy.current = false;
        setState({ kind: "error", error: r.error });
        return;
      }
    }
    busy.current = false;
    setState({ kind: "saved" });
  }, []);

  /** Applies a change; `now` saves without waiting (for deletes and big steps). */
  const update = useCallback(
    (change: (s: Setup) => Setup, now = false) => {
      const next = change(latest.current);
      latest.current = next;
      setSetup(next);
      dirty.current = true;
      setState((st) => (st.kind === "saving" ? st : { kind: "unsaved" }));
      window.clearTimeout(timer.current);
      if (now) void flush();
      else timer.current = window.setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  // Don't lose an edit when leaving the page.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || busy.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return { setup, update, state, retry: flush };
}
