import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { grantApp, grantItem, createShareLink, itemRole, type Actor } from "@/lib/access";
import {
  AccessDenied,
  addItem,
  addItems,
  bringForward,
  createList,
  deleteItem,
  deleteList,
  getList,
  InputError,
  listsFor,
  previousItems,
  setReceived,
  setStarred,
  suggestedDate,
  updateItem,
  updateList,
} from "@/lib/gyfte/data";
import { pool } from "@/lib/db";

let hudson: Actor, molly: Actor, outsider: Actor;

describeDb("gyfte lists and items", () => {
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

  const christmas = (actor: Actor, name = "Me") =>
    createList(actor, { forMe: true, recipientName: name, occasion: "christmas", date: "" });

  it("needs Gyfte access to make a list", async () => {
    await expect(christmas(outsider)).rejects.toBeInstanceOf(AccessDenied);
    const id = await christmas(molly, "Molly");
    expect((await getList(molly, id)).title).toMatch(/^Molly · Christmas \d{4}$/);
  });

  it("keeps a list private to its owner, admins included", async () => {
    const id = await christmas(molly, "Molly");
    await expect(getList(hudson, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(getList(outsider, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(addItem(hudson, id, "Socks")).rejects.toBeInstanceOf(AccessDenied);
    await expect(getList(molly, "not-a-uuid")).rejects.toBeInstanceOf(AccessDenied);
    expect((await listsFor(hudson)).current).toEqual([]);
  });

  it("lets viewers see but not change a shared list", async () => {
    const id = await christmas(molly, "Molly");
    const item = await addItem(molly, id, "Socks");
    await grantItem(molly, { app: "gyfte", type: "list", id, ownerId: molly.id }, { userId: hudson.id }, "view");
    expect((await getList(hudson, id)).items.map((i) => i.name)).toEqual(["Socks"]);
    expect((await listsFor(hudson)).current.map((l) => l.id)).toEqual([id]);
    await expect(setStarred(hudson, item, true)).rejects.toBeInstanceOf(AccessDenied);
    await expect(deleteItem(hudson, item)).rejects.toBeInstanceOf(AccessDenied);
    await expect(updateList(hudson, id, { recipientName: "x" })).rejects.toBeInstanceOf(AccessDenied);
  });

  it("adds from one box: links are cleaned and named, text is the name", async () => {
    const id = await christmas(molly, "Molly");
    await addItem(molly, id, "Pearl earrings");
    await addItem(
      molly,
      id,
      "https://www.amazon.com/STONEWARE-Stone-Coasters/dp/B000000001/ref=abc?pd_rd_w=x&th=1",
    );
    const { items } = await getList(molly, id);
    // Newest first.
    expect(items[0]).toMatchObject({ name: "Stoneware Stone Coasters", links: ["https://www.amazon.com/dp/B000000001"] });
    expect(items[1]).toMatchObject({ name: "Pearl earrings", links: [] });
    await expect(addItem(molly, id, "   ")).rejects.toBeInstanceOf(InputError);
  });

  it("edits details and refuses links that aren't web links", async () => {
    const id = await christmas(molly, "Molly");
    const item = await addItem(molly, id, "Boots");
    await updateItem(molly, item, {
      name: "Chelsea boots",
      notes: "Dark brown",
      size: "9.5",
      color: "Brown",
      price: "$200",
      links: ["https://shop.example.com/?utm_source=x", ""],
    });
    expect((await getList(molly, id)).items[0]).toMatchObject({
      name: "Chelsea boots",
      size: "9.5",
      links: ["https://shop.example.com/"],
    });
    await expect(
      updateItem(molly, item, { name: "x", notes: "", size: "", color: "", price: "", links: ["javascript:alert(1)"] }),
    ).rejects.toBeInstanceOf(InputError);
  });

  it("puts starred gifts first and received ones last", async () => {
    const id = await christmas(molly, "Molly");
    const a = await addItem(molly, id, "A");
    const b = await addItem(molly, id, "B");
    await addItem(molly, id, "C");
    await setStarred(molly, a, true);
    await setReceived(molly, b, true);
    expect((await getList(molly, id)).items.map((i) => i.name)).toEqual(["A", "C", "B"]);
    expect((await listsFor(molly)).current[0].itemCount).toBe(2);
  });

  it("brings forward unreceived gifts from the same person's last list only", async () => {
    const old = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2025-12-25" });
    const keep = await addItem(molly, old, "Candle set", { history: true });
    const got = await addItem(molly, old, "Earrings", { history: true });
    await setReceived(molly, got, true, { history: true });
    const kid = await createList(molly, { forMe: false, recipientName: "Lennox", occasion: "christmas", date: "2025-12-25" });
    await addItem(molly, kid, "Jersey", { history: true });

    const next = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2026-12-25" });
    const prev = await previousItems(molly, next);
    expect(prev?.items.map((i) => i.id)).toEqual([keep]);

    // Ids from someone else's list are ignored.
    const strangers = await christmas(hudson, "Hudson");
    const theirs = await addItem(hudson, strangers, "Not yours");
    expect(await bringForward(molly, next, [keep, theirs])).toBe(1);
    expect((await getList(molly, next)).items.map((i) => i.name)).toEqual(["Candle set"]);
    expect(await previousItems(molly, next)).not.toBeNull();
  });

  it("separates current lists from history", async () => {
    await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2023-12-25" });
    await christmas(molly, "Molly");
    const { current, past } = await listsFor(molly);
    expect(current).toHaveLength(1);
    expect(past.map((l) => l.title)).toEqual(["Molly · Christmas 2023"]);
  });

  it("suggests a person's next birthday from their last birthday list", async () => {
    expect(await suggestedDate(molly, "birthday", { me: true, name: "Molly" })).toBeNull();
    await createList(molly, { forMe: true, recipientName: "Molly", occasion: "birthday", date: "2024-03-14" });
    expect(await suggestedDate(molly, "birthday", { me: true, name: "Molly" })).toMatch(/-03-14$/);
    await expect(
      createList(molly, { forMe: true, recipientName: "Molly", occasion: "birthday", date: "" }),
    ).rejects.toBeInstanceOf(InputError);
  });

  it("deletes a list with its items, grants and links", async () => {
    const id = await christmas(molly, "Molly");
    await addItem(molly, id, "Socks");
    const ref = { app: "gyfte", type: "list", id, ownerId: molly.id };
    await grantItem(molly, ref, { userId: hudson.id }, "view");
    const link = await createShareLink(molly, ref);
    await expect(deleteList(hudson, id)).rejects.toBeInstanceOf(AccessDenied);
    await deleteList(molly, id);
    expect(await itemRole(hudson, ref)).toBeNull();
    expect(await itemRole(null, ref, { linkToken: link.token })).toBeNull();
    const { rowCount } = await admin.query("select 1 from gyfte_items where list_id = $1", [id]);
    expect(rowCount).toBe(0);
  });

  it("bulk adds in paste order on top, leaving out unticked lines, managers only", async () => {
    const id = await christmas(molly, "Molly");
    await addItem(molly, id, "Already here");
    const n = await addItems(molly, id, "Clothes\n- Socks $12\n- Hat (size M)\nhttps://www.amazon.com/Cozy-Blanket/dp/B000000001", [0]);
    expect(n).toBe(3);
    const { items } = await getList(molly, id);
    expect(items.map((i) => i.name)).toEqual(["Socks", "Hat", "Cozy Blanket", "Already here"]);
    expect(items[0].price).toBe("$12");
    expect(items[1].size).toBe("M");

    await grantItem(molly, { app: "gyfte", type: "list", id, ownerId: molly.id }, { userId: hudson.id }, "contribute");
    await expect(addItems(hudson, id, "Sneaky")).rejects.toBeInstanceOf(AccessDenied);
    await expect(addItems(molly, id, "\n\n2025\n")).rejects.toBeInstanceOf(InputError);
  });
});
