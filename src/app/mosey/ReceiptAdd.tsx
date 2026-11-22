"use client";

import { useState } from "react";
import { uploadReceiptAction, type ReceiptState } from "./actions";
import { ExpenseForm } from "./ExpenseForm";
import { Alert } from "@/components/ui/Alert";
import { parseDollars } from "@/lib/mosey/money";

type P = { id: string; name: string };

/**
 * Redraws the photo as a JPEG no larger than 2000px. Keeps uploads small and
 * drops hidden photo data (like GPS location) before anything leaves the phone.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85));
}

/** Add an expense from a receipt photo: the AI suggests, a person checks and saves. */
export function ReceiptAdd({ tripId, people, me, defaultDay }: { tripId: string; people: P[]; me: string | null; defaultDay: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReceiptState | null>(null);
  const [key, setKey] = useState(0);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set("id", tripId);
      form.set("photo", await shrink(file).catch(() => file), "receipt.jpg");
      setResult(await uploadReceiptAction(form));
      setKey((k) => k + 1);
    } catch {
      setResult({ error: "Couldn't send the photo. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const ok = result && "receiptId" in result ? result : null;
  const d = ok?.draft;
  const prefill = d
    ? {
        description: d.description || d.merchant,
        amount: parseDollars(d.total) !== null ? d.total : "",
        // Any real date is fine (pre-trip shopping counts); the person checks it.
        spentOn: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : "",
        notes: [d.merchant && d.merchant !== d.description ? d.merchant : "", d.note].filter(Boolean).join(". "),
      }
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <label className={`inline-flex min-h-12 cursor-pointer items-center justify-center self-start rounded-[var(--radius-control)] border border-ink/40 px-4 font-semibold ${busy ? "opacity-50" : ""}`}>
        {busy ? "Reading the receipt…" : "Add from a receipt photo"}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0] ?? undefined).finally(() => (e.target.value = ""))} />
      </label>
      {result?.error && <Alert>{result.error}</Alert>}
      {ok && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-wash p-4">
          <p className="text-sm">
            {d ? (
              <>
                <span className="font-semibold">Filled in from the photo. Check it before saving.</span>
                {d.confidence !== "high" && " The total may be off."} Pick who paid and who it&apos;s split with yourself.
              </>
            ) : (
              <span className="font-semibold">{ok.draftError ?? "Photo saved. Fill in the expense by hand."}</span>
            )}{" "}
            <a href={`/mosey/receipts/${ok.receiptId}`} target="_blank" rel="noopener" className="text-accent underline-offset-4 hover:underline">
              See the photo
            </a>
          </p>
          {ok.warnings.map((w) => (
            <Alert key={w}>{w}</Alert>
          ))}
          <ExpenseForm key={key} tripId={tripId} people={people} me={me} defaultDay={defaultDay} prefill={prefill} receiptId={ok.receiptId} />
        </div>
      )}
    </div>
  );
}
