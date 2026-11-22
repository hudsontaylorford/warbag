import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, grantItem, type Actor } from "@/lib/access";
import { InputError } from "@/lib/errors";
import { createTrip, setTripMembers } from "@/lib/mosey/trips";
import { addExpense, addPerson, ledger } from "@/lib/mosey/ledger";
import { pool } from "@/lib/db";

process.env.RECEIPT_STORE_DIR = mkdtempSync(path.join(tmpdir(), "warbag-receipts-"));

// Never call the real AI in tests: a stand-in that "reads" a made-up receipt.
const fakeDraft = { merchant: "Example Market", date: "2027-06-05", total: "42.50", description: "Groceries", confidence: "high" as const, note: "" };
vi.mock("@/lib/mosey/receipt-ai", () => ({
  receiptAiConfigured: () => true,
  readReceipt: vi.fn(async () => ({ draft: fakeDraft, error: null })),
}));
const { attachReceipt, openReceipt, receiptsByExpense, sniffImage, uploadReceipt, MAX_RECEIPT_BYTES } = await import("@/lib/mosey/receipts");

const png = (n = 0) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`made-up image ${n}`)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("made-up jpeg")]);

let org: Actor, mem: Actor, viewer: Actor, outsider: Actor;
let tripId: string, ann: string;

const bytes = async (body: ReadableStream<Uint8Array> | Buffer) => (Buffer.isBuffer(body) ? body : Buffer.from(await new Response(body).arrayBuffer()));

describeDb("Mosey receipts", () => {
  beforeEach(async () => {
    org = await makeUser({ isAdmin: true });
    mem = await makeUser();
    viewer = await makeUser();
    outsider = await makeUser();
    tripId = await createTrip(org, { name: "Receipts", start: "2027-06-05", end: "2027-06-06" });
    await setTripMembers(org, tripId, { groupIds: [], userIds: [mem.id] });
    await grantItem(org, { app: "mosey", type: "trip", id: tripId, ownerId: org.id }, { userId: viewer.id }, "view");
    ann = await addPerson(org, tripId, { name: "Ann" });
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("knows images by their bytes, not their name", () => {
    expect(sniffImage(png())).toBe("image/png");
    expect(sniffImage(jpeg)).toBe("image/jpeg");
    expect(sniffImage(Buffer.from("RIFF0000WEBPVP8 "))).toBe("image/webp");
    expect(sniffImage(Buffer.from("%PDF-1.7"))).toBeNull();
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("members upload and get a suggestion; nothing is added to the money until someone saves", async () => {
    const r = await uploadReceipt(mem, tripId, png());
    expect(r.draft).toEqual(fakeDraft);
    expect(r.warnings).toEqual([]);
    expect((await ledger(org, tripId)).expenses).toEqual([]);
    await expect(uploadReceipt(viewer, tripId, png())).rejects.toBeInstanceOf(AccessDenied);
    await expect(uploadReceipt(outsider, tripId, png())).rejects.toBeInstanceOf(AccessDenied);
  });

  it("refuses non-images, empty files and big files", async () => {
    await expect(uploadReceipt(mem, tripId, Buffer.from("%PDF-1.7 fake"))).rejects.toThrow(/JPEG, PNG or WebP/);
    await expect(uploadReceipt(mem, tripId, Buffer.alloc(0))).rejects.toBeInstanceOf(InputError);
    await expect(uploadReceipt(mem, tripId, Buffer.concat([png(), Buffer.alloc(MAX_RECEIPT_BYTES)]))).rejects.toThrow(/too big/);
  });

  it("only trip members can open a receipt", async () => {
    const r = await uploadReceipt(mem, tripId, png(7));
    const seen = await openReceipt(org, r.receiptId);
    expect(seen.contentType).toBe("image/png");
    expect((await bytes(seen.body)).equals(png(7))).toBe(true);
    for (const who of [viewer, outsider, null]) await expect(openReceipt(who, r.receiptId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(openReceipt(org, "not-a-uuid")).rejects.toBeInstanceOf(AccessDenied);
  });

  it("warns about the same photo twice, and about an expense already there for that day and amount", async () => {
    await uploadReceipt(mem, tripId, png(1));
    expect((await uploadReceipt(mem, tripId, png(1))).warnings[0]).toMatch(/uploaded before/);
    await addExpense(org, tripId, { description: "Market run", amount: "42.50", spentOn: "2027-06-05", paidBy: ann, participants: [ann] });
    expect((await uploadReceipt(mem, tripId, png(2))).warnings).toEqual([expect.stringMatching(/"Market run" on the same day/)]);
  });

  it("attaches a receipt to the expense saved from it, within one trip only", async () => {
    const r = await uploadReceipt(mem, tripId, png(3));
    const e = await addExpense(mem, tripId, { description: "Groceries", amount: "42.50", spentOn: "2027-06-05", paidBy: ann, participants: [ann] });
    const other = await createTrip(org, { name: "Other", start: "2027-07-01", end: "2027-07-01" });
    const zed = await addPerson(org, other, { name: "Zed" });
    const otherExpense = await addExpense(org, other, { description: "X", amount: "1", spentOn: "2027-07-01", paidBy: zed, participants: [zed] });
    await expect(attachReceipt(org, r.receiptId, otherExpense)).rejects.toBeInstanceOf(AccessDenied);
    await expect(attachReceipt(viewer, r.receiptId, e)).rejects.toBeInstanceOf(AccessDenied);
    await attachReceipt(mem, r.receiptId, e);
    expect((await receiptsByExpense(mem, tripId)).get(e)).toBe(r.receiptId);
    await expect(attachReceipt(mem, r.receiptId, e)).rejects.toBeInstanceOf(AccessDenied); // already attached
    await expect(receiptsByExpense(viewer, tripId)).rejects.toBeInstanceOf(AccessDenied);
  });
});
