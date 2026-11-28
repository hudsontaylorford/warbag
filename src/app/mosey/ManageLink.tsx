"use client";

import Link from "next/link";

/**
 * "Manage" at the end of the trip's tabs, for organizers: opens Manage and
 * scrolls to it. On the Plan page it opens it in place; from Ideas or Money
 * it goes to Plan with Manage open.
 */
export function ManageLink({ base, here, className }: { base: string; here: boolean; className: string }) {
  return (
    <Link
      href={`${base}?manage=1#manage`}
      className={className}
      onClick={(e) => {
        if (!here) return;
        const details = document.getElementById("manage") as HTMLDetailsElement | null;
        if (!details) return;
        e.preventDefault();
        details.open = true;
        details.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        details.querySelector("summary")?.focus({ preventScroll: true });
      }}
    >
      Manage
    </Link>
  );
}
