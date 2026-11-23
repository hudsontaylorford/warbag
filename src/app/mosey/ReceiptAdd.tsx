"use client";

import { useActionState, useState } from "react";
import { discardReceiptAction, uploadReceiptAction, type ReceiptState } from "./actions";
import { ExpenseForm } from "./ExpenseForm";
import { Alert } from "@/components/ui/Alert";
import type { ReceiptDraft } from "@/lib/mosey/receipt-ai";
import { formFrom, PERSONAL_DOCUMENT_WARNING, totalsFrom } from "@/lib/mosey/receipt-form";
import type { UnsavedReceipt } from "@/lib/mosey/receipts";

type P = { id: string; name: string; kid?: boolean; householdId?: string | null };
type Current = { receiptId: string; draft: ReceiptDraft | null; draftError: string | null; warnings: string[]; canDiscard: boolean };

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

function DiscardButton({ receiptId, onGone, label = "Discard photo" }: { receiptId: string; onGone?: () => void; label?: string }) {
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof discardReceiptAction>[0], form: FormData) => {
    const next = await discardReceiptAction(prev, form);
    if (next.ok) onGone?.();
    return next;
  }, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="receiptId" value={receiptId} />
      <button type="submit" disabled={pending} className="min-h-11 self-start text-sm text-accent underline-offset-4 hover:underline disabled:opacity-50">
        {pending ? "Discarding…" : label}
      </button>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

/** Add an expense from a receipt photo: the AI suggests, a person checks and saves. */
export function ReceiptAdd({
  tripId,
  people,
  me,
  defaultDay,
  unsaved = [],
}: {
  tripId: string;
  people: P[];
  me: string | null;
  defaultDay: string;
  /** Photos uploaded earlier and never saved as an expense. */
  unsaved?: UnsavedReceipt[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  function show(next: Current | null) {
    setCurrent(next);
    setKey((k) => k + 1);
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    show(null);
    try {
      const form = new FormData();
      form.set("id", tripId);
      form.set("photo", await shrink(file).catch(() => file), "receipt.jpg");
      const result: ReceiptState = await uploadReceiptAction(form);
      if (result.error !== undefined) setError(result.error);
      else show({ ...result, canDiscard: true });
    } catch {
      setError("Couldn't send the photo. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const d = current?.draft ?? null;
  const { prefill, totals } = formFrom(d);
  const others = unsaved.filter((u) => u.receiptId !== current?.receiptId);

  return (
    <div className="flex flex-col gap-3">
      <label className={`inline-flex min-h-12 cursor-pointer items-center justify-center self-start rounded-[var(--radius-control)] border border-ink/40 px-4 font-semibold ${busy ? "opacity-50" : ""}`}>
        {busy ? "Reading the receipt…" : "Add from a receipt photo"}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0] ?? undefined).finally(() => (e.target.value = ""))} />
      </label>
      {error && <Alert>{error}</Alert>}
      {status && (
        <p role="status" className="text-sm text-soft">
          {status}
        </p>
      )}
      {current && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-control)] bg-wash p-4">
          <p className="text-sm">
            {d ? (
              <>
                <span className="font-semibold">Filled in from the photo. Check it before saving.</span>
                {totals.length > 0 ? " Pick the total that was charged." : d.confidence !== "high" ? " Check the total against the receipt." : ""} Pick who paid and who it&apos;s split with
                yourself.
              </>
            ) : (
              <span className="font-semibold">{current.draftError ?? "Photo saved. Fill in the expense by hand."}</span>
            )}{" "}
            <a href={`/mosey/receipts/${current.receiptId}`} target="_blank" rel="noopener" className="text-accent underline-offset-4 hover:underline">
              See the photo
            </a>
          </p>
          {current.warnings.map((w) => (
            <Alert key={w}>{w}</Alert>
          ))}
          <ExpenseForm
            key={key}
            tripId={tripId}
            people={people}
            me={me}
            defaultDay={defaultDay}
            prefill={prefill}
            totals={totals}
            receiptId={current.receiptId}
            onAdded={() => {
              show(null);
              setStatus("Added ✓");
            }}
          />
          {current.canDiscard && (
            <DiscardButton
              receiptId={current.receiptId}
              onGone={() => {
                show(null);
                setStatus("Photo discarded.");
              }}
            />
          )}
        </div>
      )}
      {others.length > 0 && (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">
            {others.length === 1 ? "1 photo not saved as an expense" : `${others.length} photos not saved as expenses`}
          </summary>
          <ul className="flex flex-col divide-y divide-line">
            {others.map((u) => {
              const t = u.draft ? totalsFrom(u.draft)[0] : undefined;
              return (
                <li key={u.receiptId} className="flex flex-col gap-1 py-3">
                  <span className="break-words">
                    <span className="font-semibold">{u.draft?.merchant || "Receipt"}</span>
                    {t && ` · $${t.amount}`}
                  </span>
                  <span className="text-soft">
                    {u.uploadedBy ? `${u.uploadedBy}, ` : ""}
                    {new Date(u.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}
                  </span>
                  <div className="flex flex-wrap gap-x-5">
                    <button
                      type="button"
                      onClick={() => {
                        setStatus(null);
                        show({ receiptId: u.receiptId, draft: u.draft, draftError: u.draftError, warnings: u.draft?.personalDocument ? [PERSONAL_DOCUMENT_WARNING] : [], canDiscard: u.canDiscard });
                      }}
                      className="min-h-11 text-accent underline-offset-4 hover:underline"
                    >
                      Use it
                    </button>
                    <a href={`/mosey/receipts/${u.receiptId}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center text-accent underline-offset-4 hover:underline">
                      See the photo
                    </a>
                    {u.canDiscard && <DiscardButton receiptId={u.receiptId} label="Discard" />}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
