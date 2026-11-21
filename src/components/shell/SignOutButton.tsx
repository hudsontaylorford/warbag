"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Button
      variant="quiet"
      disabled={busy}
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
    </Button>
  );
}
