"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-device preferences (mic choice, checklist ticks), kept in this
 * browser only under `roomtune.*`. Null on the server and when storage is
 * blocked, so the page still works without it.
 */
const EVENT = "roomtune-pref";

function read(key: string): string | null {
  try {
    return localStorage.getItem(`roomtune.${key}`);
  } catch {
    return null;
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

export function usePref(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => null);
  const set = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(`roomtune.${key}`, v);
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
