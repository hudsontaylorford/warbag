import { describe, expect, it } from "vitest";
import { formFrom, totalsFrom } from "@/lib/mosey/receipt-form";
import type { ReceiptDraft } from "@/lib/mosey/receipt-ai";

// Made-up receipts.
const draft = (over: Partial<ReceiptDraft>): ReceiptDraft => ({
  merchant: "Example Tavern",
  date: "2024-08-11",
  total: "312.45",
  description: "Dinner",
  candidates: [],
  confidence: "high",
  note: "",
  ...over,
});

describe("receipt suggestion to form", () => {
  it("a clear total is filled in, with nothing to pick", () => {
    const f = formFrom(draft({}));
    expect(f.prefill?.amount).toBe("312.45");
    expect(f.totals).toEqual([]);
  });

  it("several possible totals: nothing filled in, the reader's pick first with its own label", () => {
    const f = formFrom(
      draft({
        total: "381.90",
        confidence: "low",
        candidates: [
          { amount: "312.45", label: "Check before tip" },
          { amount: "381.9", label: "Card slip with written tip" },
          { amount: "$312.45", label: "Repeat" },
          { amount: "abc", label: "Junk" },
        ],
      }),
    );
    expect(f.prefill?.amount).toBe("");
    expect(f.totals).toEqual([
      { amount: "381.90", label: "Card slip with written tip" },
      { amount: "312.45", label: "Check before tip" },
    ]);
  });

  it("a total missing from the candidates still comes first", () => {
    expect(totalsFrom(draft({ total: "50", candidates: [{ amount: "45", label: "Before tip" }] }))).toEqual([
      { amount: "50.00", label: "Most likely" },
      { amount: "45.00", label: "Before tip" },
    ]);
  });

  it("an unreadable date stays empty instead of a guess; older drafts without candidates still work", () => {
    expect(formFrom(draft({ date: "" })).prefill?.spentOn).toBe("");
    expect(formFrom(draft({ date: "8/11/24" })).prefill?.spentOn).toBe("");
    const old = { ...draft({}) } as Partial<ReceiptDraft>;
    delete old.candidates;
    expect(formFrom(old as ReceiptDraft).prefill?.amount).toBe("312.45");
    expect(formFrom(null)).toEqual({ prefill: undefined, totals: [] });
  });
});
