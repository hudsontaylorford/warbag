"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="min-h-11 px-1 text-sm text-accent underline-offset-4 hover:underline disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        setFailed(false);
        const { error } = await authClient.signOut();
        if (error) {
          setBusy(false);
          setFailed(true);
          return;
        }
        router.replace("/");
        router.refresh();
      }}
    >
      {busy ? "Signing out…" : failed ? "Couldn't sign out. Try again" : "Sign out"}
    </button>
  );
}
