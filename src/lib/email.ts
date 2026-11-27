import "server-only";
import { appendFile } from "node:fs/promises";

type Message = { to: string; subject: string; text: string };

/**
 * Sends one email through Resend.
 *
 * Without RESEND_API_KEY: in development the message is printed to the
 * server console (so sign-in works locally); in production it throws,
 * because silently dropping a sign-in code is worse than an error.
 */
export async function sendEmail({ to, subject, text }: Message): Promise<void> {
  // Made-up addresses (sample people, Mosey guests) never get email.
  if (to.trim().toLowerCase().endsWith(".invalid")) return;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!key || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email is not configured: set RESEND_API_KEY and EMAIL_FROM.");
    }
    console.log(`\n[email to ${to}] ${subject}\n${text}\n`);
    // Automated tests read sign-in codes from this file. Dev and test only.
    if (process.env.EMAIL_OUTBOX_FILE) {
      await appendFile(process.env.EMAIL_OUTBOX_FILE, JSON.stringify({ to, subject, text }) + "\n");
    }
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) {
    throw new Error(`Resend refused the email (${res.status}).`);
  }
}

export function signInCodeEmail(code: string): { subject: string; text: string } {
  return {
    subject: `${code} is your warbag code`,
    text: `Your warbag sign-in code is ${code}\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.`,
  };
}

export function signInLinkEmail(url: string, group: string): { subject: string; text: string } {
  return {
    subject: group ? `Your sign-in link for ${group}` : "Your warbag sign-in link",
    text:
      `Tap to sign in${group ? ` and see ${group}` : ""} on warbag:\n\n${url}\n\n` +
      "It works once, for the next hour, and keeps you signed in on that phone. " +
      "If you didn't ask for it, you can ignore this email.",
  };
}
