import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { grantApp, grantItem, type Actor } from "@/lib/access";
import {
  AccessDenied,
  addItem,
  addItems,
  bringForward,
  copyForward,
  createList,
  deleteItem,
  deleteList,
  getList,
  InputError,
  setReceived,
  setStarred,
  updateItem,
  updateList,
} from "@/lib/gyfte/data";
import { pool } from "@/lib/db";

let hudson: Actor, molly: Actor;
const H = { history: true };
const ref = (id: string, ownerId: string) => ({ app: "gyfte", type: "list", id, ownerId });
const details = { name: "x", notes: "", size: "", color: "", price: "", links: [] as string[] };

describeDb("history is read-only, copy to this year", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    molly = await makeUser();
    await grantApp(hudson, "gyfte", { userId: molly.id });
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  const pastList = async () => {
    const id = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2024-12-25" });
    const keep = await addItem(molly, id, "Wool scarf", H);
    const got = await addItem(molly, id, "Candle", H);
    await setReceived(molly, got, true, H);
    return { id, keep, got };
  };

  it("refuses every change to a past list unless Edit history is on", async () => {
    const { id, keep } = await pastList();
    const refused = [
      addItem(molly, id, "New"),
      addItems(molly, id, "A\nB"),
      updateItem(molly, keep, details),
      setStarred(molly, keep, true),
      setReceived(molly, keep, true),
      deleteItem(molly, keep),
      updateList(molly, id, { recipientName: "M" }),
      deleteList(molly, id),
    ];
    for (const call of refused) await expect(call).rejects.toBeInstanceOf(InputError);
    expect((await getList(molly, id)).items.map((i) => i.name)).toEqual(["Wool scarf", "Candle"]);

    await setStarred(molly, keep, true, H);
    await updateList(molly, id, { recipientName: "Molly F" }, H);
    expect((await getList(molly, id)).recipientName).toBe("Molly F");
  });

  it("doesn't restrict current lists", async () => {
    const id = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "" });
    const item = await addItem(molly, id, "Socks");
    await setStarred(molly, item, true);
    await deleteItem(molly, item);
    expect((await getList(molly, id)).items).toEqual([]);
  });

  it("won't bring gifts forward into a past list", async () => {
    await pastList();
    const older = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2025-12-25" });
    await expect(bringForward(molly, older, [])).rejects.toBeInstanceOf(InputError);
  });

  it("copies chosen gifts to this year's list, creating it, without claims, leaving the old list alone", async () => {
    const { id, keep, got } = await pastList();
    await admin.query(
      `insert into gyfte_claims (item_id, list_id, claimer_id, item_name, list_title) values ($1, $2, $3, 'Wool scarf', 'x')`,
      [keep, id, hudson.id],
    );
    const r = await copyForward(molly, id, [keep]);
    expect(r.copied).toBe(1);
    const target = await getList(molly, r.listId);
    expect(target.past).toBe(false);
    expect(target.title).toMatch(/^Molly · Christmas \d{4}$/);
    expect(target.items.map((i) => i.name)).toEqual(["Wool scarf"]);
    const { rowCount } = await admin.query("select 1 from gyfte_claims where list_id = $1", [r.listId]);
    expect(rowCount).toBe(0);

    // Copying again adds nothing new; adding the received one is an explicit choice.
    const again = await copyForward(molly, id, [keep, got]);
    expect(again).toMatchObject({ listId: r.listId, copied: 1, skipped: 1 });
    expect((await getList(molly, r.listId)).items.map((i) => i.name).sort()).toEqual(["Candle", "Wool scarf"]);
    expect((await getList(molly, id)).items).toHaveLength(2);
  });

  it("copies into an existing current list, and only the owner can copy", async () => {
    const { id, keep } = await pastList();
    const current = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "" });
    expect((await copyForward(molly, id, [keep])).listId).toBe(current);

    await grantItem(molly, ref(id, molly.id), { userId: hudson.id }, "manage");
    await expect(copyForward(hudson, id, [keep])).rejects.toBeInstanceOf(AccessDenied);
  });

  it("copies a birthday list to the next birthday on the same day", async () => {
    const bday = await createList(molly, { forMe: false, recipientName: "Kid", occasion: "birthday", date: "2024-03-14" });
    const gift = await addItem(molly, bday, "Blocks", H);
    const r = await copyForward(molly, bday, [gift]);
    expect((await getList(molly, r.listId)).occasionDate).toMatch(/-03-14$/);
  });
});
