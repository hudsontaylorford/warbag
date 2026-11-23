import { parseDollars } from "./money";
import type { ReceiptDraft } from "./receipt-ai";

/** Turning the reader's suggestion into what the expense form shows. No server code. */

export const PERSONAL_DOCUMENT_WARNING = "This photo also shows an ID or a card. Only trip members can see it, but you can discard it and retake the photo without it.";

type Total = { amount: string; label: string };

function addTotal(all: { cents: number; label: string }[], amount: string | number | null | undefined, label: string) {
  const cents = typeof amount === "number" ? amount : amount ? parseDollars(amount) : null;
  if (cents !== null && cents > 0 && !all.some((x) => x.cents === cents)) all.push({ cents, label });
}

/** Each tip-table row's total, printed or worked out from the check amount plus the row's tip. */
function rowTotal(d: ReceiptDraft, row: ReceiptDraft["tipTable"][number]): number | null {
  const printed = parseDollars(row.total);
  if (printed !== null) return printed;
  const base = parseDollars(d.checkTotal);
  const tip = parseDollars(row.tip);
  return base !== null && tip !== null ? base + tip : null;
}

/**
 * Amounts that could be the charge, as "12.34", no repeats. When the total
 * came from a tip table, every row is offered, marked rows first, because a
 * tick is easy to misread by one row. Otherwise the reader's total comes
 * first, with its label from the candidates when it has one.
 */
export function totalsFrom(d: ReceiptDraft): Total[] {
  const all: { cents: number; label: string }[] = [];
  const rows = d.tipTable ?? [];
  if (d.totalSource === "tip_table") {
    for (const r of [...rows.filter((r) => r.marked), ...rows.filter((r) => !r.marked)]) {
      addTotal(all, rowTotal(d, r), `${r.percent} tip${r.marked ? " (marked)" : ""}`);
    }
  }
  const main = parseDollars(d.total);
  const label = (d.candidates ?? []).find((c) => parseDollars(c.amount) === main)?.label ?? "Most likely";
  addTotal(all, main, label);
  for (const c of d.candidates ?? []) addTotal(all, c.amount, c.label);
  return all.map((x) => ({ amount: (x.cents / 100).toFixed(2), label: x.label }));
}

/**
 * Ask instead of filling in when more than one amount is possible, or when
 * the total was worked out from a tip table or an added handwritten tip:
 * those are exactly the readings that can be confidently wrong.
 */
export function mustAsk(d: ReceiptDraft, totals: Total[]): boolean {
  return totals.length > 1 || (totals.length > 0 && (d.totalSource === "tip_table" || d.totalSource === "added_tip"));
}

export function formFrom(d: ReceiptDraft | null) {
  if (!d) return { prefill: undefined, totals: [] };
  const totals = totalsFrom(d);
  const ask = mustAsk(d, totals);
  return {
    totals: ask ? totals : [],
    prefill: {
      description: d.description || d.merchant,
      // When asking, the person picks the total; nothing is pre-filled.
      amount: !ask && totals[0] ? totals[0].amount : "",
      // Any real date is fine (pre-trip shopping counts); an unreadable one stays empty.
      spentOn: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : "",
      notes: [d.merchant && d.merchant !== d.description ? d.merchant : "", d.note].filter(Boolean).join(". "),
    },
  };
}
