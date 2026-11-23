"use client";

import { useState } from "react";

/** Manage's disclosure: starts open when asked to, then stays however the person leaves it (Add doesn't snap it shut). */
export function ManageDetails({ initiallyOpen, children }: { initiallyOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details id="manage" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {children}
    </details>
  );
}
