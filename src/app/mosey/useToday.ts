"use client";

import { useSyncExternalStore } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const subscribe = (onChange: () => void) => {
  const t = setInterval(onChange, 60_000);
  return () => clearInterval(t);
};

/**
 * Today as "YYYY-MM-DD" on this phone or computer, or null while the page
 * is rendered on the server (so server and browser HTML always match).
 */
export function useToday(): string | null {
  return useSyncExternalStore(subscribe, localDay, () => null);
}
