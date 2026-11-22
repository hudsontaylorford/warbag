import { parseDollars } from "./money";
import type { ReceiptDraft } from "./receipt-ai";

/** Turning the reader's suggestion into what the expense form shows. No server code. */

/**
 * Amounts that could be the charge, as "12.34", no repeats. The reader's
 * total comes first, with its label from the candidates when it has one.
 */
export function totalsFrom(d: ReceiptDraft): { amount: string; label: string }[] {
  const all: { cents: number; label: string }[] = [];
  for (const t of d.candidates ?? []) {
    const cents = parseDollars(t.amount);
    if (cents !== null && cents > 0 && !all.some((x) => x.cents === cents)) all.push({ cents, label: t.label });
  }
  const main = parseDollars(d.total);
  if (main !== null && main > 0) {
    const at = all.findIndex((x) => x.cents === main);
    const first = at >= 0 ? all.splice(at, 1)[0] : { cents: main, label: "Most likely" };
    all.unshift(first);
  }
  return all.map((x) => ({ amount: (x.cents / 100).toFixed(2), label: x.label }));
}

export function formFrom(d: ReceiptDraft | null) {
  if (!d) return { prefill: undefined, totals: [] };
  const totals = totalsFrom(d);
  const unsure = totals.length > 1;
  return {
    totals: unsure ? totals : [],
    prefill: {
      description: d.description || d.merchant,
      // Several possible totals: the person picks one; nothing is pre-filled.
      amount: !unsure && totals[0] ? totals[0].amount : "",
      // Any real date is fine (pre-trip shopping counts); an unreadable one stays empty.
      spentOn: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : "",
      notes: [d.merchant && d.merchant !== d.description ? d.merchant : "", d.note].filter(Boolean).join(". "),
    },
  };
}

