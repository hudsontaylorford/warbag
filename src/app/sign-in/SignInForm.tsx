"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

type Step = "email" | "code";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });
    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many tries. Wait a minute, then send a new code."
          : "Couldn't send a code. Check the email address and try again.",
      );
      return;
    }
    setStep("code");
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({
      email: email.trim(),
      otp: code.trim(),
    });
    if (error) {
      setBusy(false);
      setError(
        error.status === 429
          ? "Too many tries. Wait a minute, then send a new code."
          : "That code didn't work. Check it, or send a new one.",
      );
      return;
    }
    // Refresh so server components render with the new session.
    router.replace(next);
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={signIn} className="flex flex-col gap-4">
      <Alert tone="info">
        If {email.trim()} has access, a 6-digit code is on its way. It works for 10 minutes.
      </Alert>
      <p className="text-sm text-soft">
        No code after a couple of minutes? Check spam. warbag is invite only, so if nobody has invited this email yet, ask the person who sent you here to add it.
      </p>
      <Field
        label="Code"
        name="code"
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />
      {error && <Alert>{error}</Alert>}
      <Button type="submit" disabled={busy || code.length !== 6}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <button
        type="button"
        className="min-h-11 text-accent underline-offset-4 hover:underline"
        onClick={() => {
          setStep("email");
          setCode("");
          setError(null);
        }}
      >
        Use a different email
      </button>
    </form>
  );
}
