"use client";

import { useSyncExternalStore } from "react";

/**
 * The time now in this browser, updated every 30 seconds, or null while
 * the page is drawn on the server. Times are shown in the viewer's own
 * time zone, so they're only drawn once the browser has the page.
 */
let now = Date.now();
const listeners = new Set<() => void>();
let timer: number | undefined;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (timer === undefined) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(onChange);
    if (!listeners.size) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}

/** "Tue, Dec 2, 9:00 AM" in this browser's time zone (the year only if it isn't this year). */
export function whenLabel(iso: string, nowMs: number): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date(nowMs).getFullYear();
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** An ISO time as the value of a datetime-local input, in this browser's time zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
