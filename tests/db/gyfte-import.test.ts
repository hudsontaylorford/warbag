import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { grantApp, type Actor } from "@/lib/access";
import { AccessDenied, getList, InputError, listsFor } from "@/lib/gyfte/data";
import { applyImportDraft, createImportDraft, discardImportDraft, getImportDraft, openDraftId } from "@/lib/gyfte/imports";
import { pool } from "@/lib/db";
import { giftSheetBuffer } from "../support/gift-sheet";

let hudson: Actor, molly: Actor, outsider: Actor;

describeDb("gyfte spreadsheet import", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    molly = await makeUser();
    outsider = await makeUser();
    await grantApp(hudson, "gyfte", { userId: molly.id });
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  const allKeys = async (actor: Actor, id: string) =>
    (await getImportDraft(actor, id)).sheet.lists.flatMap((l) => l.items.filter((i) => i.include).map((i) => i.key));

  it("reads a file into a private draft without creating any lists", async () => {
    const id = await createImportDraft(hudson, "family.xlsx", await giftSheetBuffer());
    expect(await openDraftId(hudson)).toBe(id);
    expect((await listsFor(hudson)).past).toEqual([]);
    await expect(getImportDraft(molly, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(applyImportDraft(molly, id, { keep: [], me: null })).rejects.toBeInstanceOf(AccessDenied);
    await expect(discardImportDraft(molly, id)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("needs Gyfte, and refuses files that aren't gift spreadsheets", async () => {
    await expect(createImportDraft(outsider, "x.xlsx", await giftSheetBuffer())).rejects.toBeInstanceOf(AccessDenied);
    await expect(createImportDraft(molly, "x.xlsx", new TextEncoder().encode("not a spreadsheet").buffer)).rejects.toBeInstanceOf(
      InputError,
    );
    await expect(createImportDraft(molly, "x.xlsx", new ArrayBuffer(0))).rejects.toBeInstanceOf(InputError);
  });

  it("creates the ticked gifts as private Christmas lists in History, received ones as Got it", async () => {
    const id = await createImportDraft(molly, "family.xlsx", await giftSheetBuffer());
    const keep = (await allKeys(molly, id)).filter((k) => k !== "Avery|8"); // untick Hiking socks
    const result = await applyImportDraft(molly, id, { keep, me: "Sam" });
    expect(result).toEqual({ lists: 5, gifts: keep.length });

    const { current, past } = await listsFor(molly);
    expect(current).toEqual([]);
    expect(past.map((l) => l.title)).toContain("Avery · Christmas 2025");
    const avery2025 = past.find((l) => l.title === "Avery · Christmas 2025")!;
    const list = await getList(molly, avery2025.id);
    expect(list.items.map((i) => i.name)).toEqual(["Rain jacket", "Lap steel guitar"]);
    const avery2020 = await getList(molly, past.find((l) => l.title === "Avery · Christmas 2020")!.id);
    expect(avery2020.items.find((i) => i.name === "Steak knives")?.receivedAt).not.toBeNull();

    // The tab picked as "me" is marked as the importer's own.
    const { rows } = await admin.query(
      "select recipient_name, recipient_user_id from gyfte_lists where owner_id = $1 order by recipient_name",
      [molly.id],
    );
    expect(rows.filter((r) => r.recipient_user_id === molly.id).map((r) => r.recipient_name)).toEqual(["Sam", "Sam"]);
    expect(rows.filter((r) => r.recipient_name === "Avery").every((r) => r.recipient_user_id === null)).toBe(true);

    // Private: nobody else sees them, admins included.
    await expect(getList(hudson, avery2025.id)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("can't be applied twice, and a second import skips lists that already exist", async () => {
    const first = await createImportDraft(molly, "family.xlsx", await giftSheetBuffer());
    await applyImportDraft(molly, first, { keep: await allKeys(molly, first), me: null });
    await expect(applyImportDraft(molly, first, { keep: [], me: null })).rejects.toBeInstanceOf(InputError);

    const second = await createImportDraft(molly, "family.xlsx", await giftSheetBuffer());
    expect((await getImportDraft(molly, second)).existing).toHaveLength(5);
    expect(await applyImportDraft(molly, second, { keep: await allKeys(molly, second), me: null })).toEqual({ lists: 0, gifts: 0 });
    const { rowCount } = await admin.query("select 1 from gyfte_lists where owner_id = $1", [molly.id]);
    expect(rowCount).toBe(5);
  });

  it("keeps one open draft at a time and discards on request", async () => {
    const a = await createImportDraft(molly, "a.xlsx", await giftSheetBuffer());
    const b = await createImportDraft(molly, "b.xlsx", await giftSheetBuffer());
    expect(await openDraftId(molly)).toBe(b);
    await expect(getImportDraft(molly, a)).rejects.toBeInstanceOf(AccessDenied);
    await discardImportDraft(molly, b);
    expect(await openDraftId(molly)).toBeNull();
  });
});
