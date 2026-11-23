import { describe, expect, it } from "vitest";
import { formFrom, sumMismatch, totalsFrom } from "@/lib/mosey/receipt-form";

const line = (label: string, amount: string) => ({ label, amount });
const row = (percent: string, tip: string, total: string, marked = false) => ({ percent, tip, total, marked });
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
  personalDocument: false,
  totalSource: "printed",
  checkTotal: "",
  tipTable: [],
  printedLines: [],
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

  it("a total worked out from a tip table always asks, offering every row, marked first", () => {
    // Shaped like a slip whose tick is easy to misread by one row (made-up numbers).
    const f = formFrom(
      draft({
        total: "338.97",
        confidence: "high",
        totalSource: "tip_table",
        checkTotal: "281.99",
        tipTable: [row("18%", "46.62", "328.61"), row("20%", "51.80", "333.79"), row("22%", "56.98", "", true), row("25%", "64.75", "346.74")],
      }),
    );
    expect(f.prefill?.amount).toBe("");
    expect(f.totals.map((t) => t.amount)).toEqual(["338.97", "328.61", "333.79", "346.74"]);
    expect(f.totals[0].label).toBe("22% tip (marked)");
  });

  it("a cut-off marked row is still offered, worked out from the check amount", () => {
    const f = formFrom(draft({ total: "", totalSource: "tip_table", checkTotal: "100.00", tipTable: [row("20%", "", "", false), row("25%", "25.00", "", true)] }));
    expect(f.totals).toEqual([{ amount: "125.00", label: "25% tip (marked)" }]);
    expect(f.prefill?.amount).toBe("");
  });

  it("an added handwritten tip asks even with one amount; a written or printed total doesn't", () => {
    expect(formFrom(draft({ total: "376.90", totalSource: "added_tip" })).totals).toEqual([{ amount: "376.90", label: "Most likely" }]);
    expect(formFrom(draft({ total: "461.75", totalSource: "written" })).prefill?.amount).toBe("461.75");
    // A tip table that wasn't used (nothing marked, printed total) doesn't ask.
    expect(formFrom(draft({ total: "216.64", tipTable: [row("20%", "36.00", "252.64")] })).prefill?.amount).toBe("216.64");
  });

  it("a misread digit shows when the printed lines don't add up: it asks, offering both", () => {
    // Shaped like a real misread: lines say 167.66, the total was read as 167.86 (made-up receipt).
    const d = draft({ total: "167.86", checkTotal: "167.86", printedLines: [line("Subtotal", "154.00"), line("Tax", "13.66")] });
    expect(sumMismatch(d)).toBe(16766);
    const f = formFrom(d);
    expect(f.prefill?.amount).toBe("");
    expect(f.totals).toEqual([
      { amount: "167.86", label: "Most likely" },
      { amount: "167.66", label: "What the receipt's lines add up to" },
    ]);
  });

  it("lines that add up change nothing: fees, several taxes, a printed gratuity, a discount", () => {
    for (const d of [
      draft({ total: "327.79", printedLines: [line("Subtotal", "293.00"), line("Sales Tax", "26.00"), line("Non Cash Fee", "8.79")] }),
      draft({ total: "228.98", printedLines: [line("Subtotal", "203.00"), line("State Tax", "14.21"), line("Local Tax", "4.57"), line("Alcohol Tax", "7.20")] }),
      // A gratuity line is part of the printed total even when checkTotal leaves it out.
      draft({ total: "438.18", checkTotal: "370.18", printedLines: [line("Subtotal", "340.00"), line("Sales Tax", "30.18"), line("Gratuity (20%)", "68.00")] }),
      draft({ total: "95.00", printedLines: [line("Subtotal", "100.00"), line("Discount", "-10.00"), line("Tax", "5.00")] }),
    ]) {
      expect(sumMismatch(d)).toBeNull();
      expect(formFrom(d).prefill?.amount).toBe(d.total);
    }
  });

  it("with a tip, the lines are checked against the amount before the tip", () => {
    const ok = draft({ total: "461.75", totalSource: "written", checkTotal: "372.38", printedLines: [line("Subtotal", "340.00"), line("Tax", "32.38")] });
    expect(sumMismatch(ok)).toBeNull();
    const off = draft({ total: "461.75", totalSource: "written", checkTotal: "372.88", printedLines: [line("Subtotal", "340.00"), line("Tax", "32.38")] });
    expect(sumMismatch(off)).toBe(46125);
  });

  it("nothing to check: no lines, one line, or an unreadable line", () => {
    expect(sumMismatch(draft({}))).toBeNull();
    expect(sumMismatch(draft({ printedLines: [line("Subtotal", "1.00")] }))).toBeNull();
    expect(sumMismatch(draft({ printedLines: [line("Subtotal", "1.00"), line("Tax", "")] }))).toBeNull();
  });
});
