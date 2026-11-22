import { describe, expect, it } from "vitest";
import { readReceipt, receiptAiConfigured, ReceiptDraft } from "@/lib/mosey/receipt-ai";

describe("receipt reading", () => {
  it("without an API key, says so and makes no call", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(receiptAiConfigured()).toBe(false);
      expect(await readReceipt(Buffer.from("x"), "image/jpeg")).toEqual({ draft: null, error: expect.stringMatching(/by hand/) });
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it("asks only for merchant, date, total and description, never who paid or who shares", () => {
    expect(Object.keys(ReceiptDraft.shape).sort()).toEqual(["candidates", "confidence", "date", "description", "merchant", "note", "total"]);
  });
});
