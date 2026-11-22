import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { readReceipt } from "@/lib/mosey/receipt-ai";
import { formFrom } from "@/lib/mosey/receipt-form";
import { sniffImage } from "@/lib/mosey/receipts";

/**
 * Runs the real receipt reader over photos in RECEIPT_EVAL_DIR, which holds
 * the images and an expected.json. Real receipts stay in that folder, never
 * in the repo. Costs a few cents a run; needs ANTHROPIC_API_KEY.
 *
 * expected.json: { "photo.jpg": { "total": "12.34", "date": "2024-05-13" } }
 *   total: what was charged. "date": "" means the date can't be read.
 *   "pick": ["381.90", "312.45"] instead of total means the right result is
 *   to ask: the form must offer those amounts and fill in none.
 *
 *   RECEIPT_EVAL_DIR=/path/to/folder npm run eval:receipts
 */
type Expect = { total?: string; pick?: string[]; date: string };

const dir = process.env.RECEIPT_EVAL_DIR;
const ready = Boolean(dir && process.env.ANTHROPIC_API_KEY);

it.skipIf(!ready)("reads real receipts the way a person would", async () => {
  const expected = JSON.parse(readFileSync(path.join(dir!, "expected.json"), "utf8")) as Record<string, Expect>;
  const rows: string[] = [];
  let wrong = 0;
  for (const [file, want] of Object.entries(expected)) {
    const image = readFileSync(path.join(dir!, file));
    const { draft, error } = await readReceipt(image, sniffImage(image)!);
    const { prefill, totals } = formFrom(draft);
    const offered = totals.map((t) => t.amount);
    const totalOk = want.pick
      ? prefill?.amount === "" && want.pick.every((p) => offered.includes(p))
      : prefill?.amount === want.total; // filled in, no picking needed
    const dateOk = (prefill?.spentOn ?? "") === want.date;
    if (!totalOk || !dateOk) wrong++;
    rows.push(
      [
        totalOk && dateOk ? "ok  " : "MISS",
        file,
        `total ${prefill?.amount || (offered.length ? `pick ${offered.join(" / ")}` : "-")} (want ${want.total ?? `pick ${want.pick!.join(" / ")}`})`,
        `date ${prefill?.spentOn || "-"} (want ${want.date || "-"})`,
        draft ? `${draft.confidence}${draft.note ? `: ${draft.note}` : ""}` : `error: ${error}`,
      ].join(" | "),
    );
  }
  console.log(`\n${rows.join("\n")}\n${Object.keys(expected).length - wrong}/${Object.keys(expected).length} right\n`);
  expect(wrong).toBe(0);
});
