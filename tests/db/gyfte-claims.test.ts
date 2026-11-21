import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { addToGroup, createGroup, grantApp, grantItem, type Actor } from "@/lib/access";
import {
  AccessDenied,
  addItem,
  bringForward,
  createList,
  deleteItem,
  getList,
  InputError,
  setReceived,
  updateList,
} from "@/lib/gyfte/data";
import { claimItem, dismissClaim, myClaims, unclaimItem } from "@/lib/gyfte/claims";
import { createListLink, listByLink, revokeListLink, setSharing, shareLikeLast, sharingFor } from "@/lib/gyfte/sharing";
import { pool } from "@/lib/db";

let hudson: Actor, molly: Actor, dad: Actor, aunt: Actor, stranger: Actor;
let family: string;

const ref = (id: string, ownerId: string) => ({ app: "gyfte", type: "list", id, ownerId });
const hasClaimInfo = (o: object) => "claim" in o;

describeDb("gyfte claims and sharing", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    molly = await makeUser();
    dad = await makeUser();
    aunt = await makeUser();
    stranger = await makeUser();
    family = await createGroup(hudson, "Family");
    for (const p of [hudson, molly, dad, aunt]) await addToGroup(hudson, family, p.id);
    for (const p of [molly, dad, aunt, stranger]) await grantApp(hudson, "gyfte", { userId: p.id });
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  async function mollysList() {
    const id = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "" });
    await setSharing(molly, id, { groupIds: [family], userIds: [], editorIds: [] });
    const item = await addItem(molly, id, "Candle set");
    return { id, item };
  }

  // ---------------------------------------------------------------- the recipient

  it("never sends the recipient any claim information, even as owner", async () => {
    const { id, item } = await mollysList();
    await claimItem(dad, item);
    const mine = await getList(molly, id);
    expect(mine.claims).toEqual({ visible: false, canClaim: false });
    for (const i of mine.items) expect(hasClaimInfo(i)).toBe(false);
    // Nothing they can do reveals it either.
    await expect(claimItem(molly, item)).rejects.toBeInstanceOf(AccessDenied);
    await expect(unclaimItem(molly, item)).rejects.toBeInstanceOf(AccessDenied);
    expect(await myClaims(molly)).toEqual([]);
  });

  it("lets the recipient edit or delete a claimed gift; the claimer sees it removed", async () => {
    const { item } = await mollysList();
    await claimItem(dad, item);
    await deleteItem(molly, item);
    const [claim] = await myClaims(dad);
    expect(claim).toMatchObject({ itemName: "Candle set", removed: true, itemId: null });
    await dismissClaim(aunt, claim.id); // not theirs: no effect
    expect(await myClaims(dad)).toHaveLength(1);
    await dismissClaim(dad, claim.id);
    expect(await myClaims(dad)).toEqual([]);
  });

  // ---------------------------------------------------------------- shoppers

  it("shows others the claim as anonymous by default, and named when set", async () => {
    const { id, item } = await mollysList();
    await claimItem(dad, item);
    expect((await getList(aunt, id)).items[0].claim).toEqual({ mine: false, by: null });
    expect((await getList(dad, id)).items[0].claim).toEqual({ mine: true, by: null });

    await updateList(molly, id, { claimsMode: "named" });
    await admin.query(`update "user" set name = 'Dad' where id = $1`, [dad.id]);
    expect((await getList(aunt, id)).items[0].claim).toEqual({ mine: false, by: "Dad" });
  });

  it("hides and blocks claims when the list has claims off", async () => {
    const { id, item } = await mollysList();
    await updateList(molly, id, { claimsMode: "off" });
    const seen = await getList(aunt, id);
    expect(seen.claims.visible).toBe(false);
    expect(hasClaimInfo(seen.items[0])).toBe(false);
    await expect(claimItem(aunt, item)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("lets only one person win a simultaneous claim", async () => {
    const { item } = await mollysList();
    const results = await Promise.allSettled([claimItem(dad, item), claimItem(aunt, item), claimItem(hudson, item)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(InputError);
    }
    const { rowCount } = await admin.query("select 1 from gyfte_claims where item_id = $1", [item]);
    expect(rowCount).toBe(1);
  });

  it("lets only the claimer undo", async () => {
    const { id, item } = await mollysList();
    await claimItem(dad, item);
    await expect(unclaimItem(aunt, item)).rejects.toBeInstanceOf(InputError);
    await unclaimItem(dad, item);
    expect((await getList(aunt, id)).items[0].claim).toBeNull();
    await claimItem(aunt, item);
    expect((await myClaims(aunt)).map((c) => c.itemName)).toEqual(["Candle set"]);
    expect(await myClaims(dad)).toEqual([]);
  });

  it("refuses claims without contribute, on received gifts and on past lists", async () => {
    const { id, item } = await mollysList();
    await grantItem(molly, ref(id, molly.id), { userId: stranger.id }, "view");
    await expect(claimItem(stranger, item)).rejects.toBeInstanceOf(AccessDenied);
    expect((await getList(stranger, id)).claims.canClaim).toBe(false);

    await setReceived(molly, item, true);
    await expect(claimItem(dad, item)).rejects.toBeInstanceOf(InputError);

    const old = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2023-12-25" });
    await setSharing(molly, old, { groupIds: [family], userIds: [], editorIds: [] });
    const oldItem = await addItem(molly, old, "Old thing");
    await expect(claimItem(dad, oldItem)).rejects.toBeInstanceOf(InputError);
  });

  it("keeps admins out of lists not shared with them", async () => {
    const id = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "" });
    const item = await addItem(molly, id, "Secret");
    await expect(getList(hudson, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(claimItem(hudson, item)).rejects.toBeInstanceOf(AccessDenied);
  });

  // ---------------------------------------------------------------- managers who aren't the recipient

  it("shows claims to a parent on a kid's list, and to a co-parent who can edit", async () => {
    const kid = await createList(dad, { forMe: false, recipientName: "Lennox", occasion: "christmas", date: "" });
    const jersey = await addItem(dad, kid, "Jersey");
    await setSharing(dad, kid, { groupIds: [family], userIds: [molly.id], editorIds: [molly.id] });
    await claimItem(aunt, jersey);
    expect((await getList(dad, kid)).items[0].claim).toEqual({ mine: false, by: null });
    expect((await getList(molly, kid)).role).toBe("manage");
    expect((await getList(molly, kid)).items[0].claim).toEqual({ mine: false, by: null });
  });

  it("shows claims to a partner who helps edit your list, never to you", async () => {
    const { id, item } = await mollysList();
    await setSharing(molly, id, { groupIds: [family], userIds: [hudson.id], editorIds: [hudson.id] });
    await claimItem(dad, item);
    expect((await getList(hudson, id)).items[0].claim).toEqual({ mine: false, by: null });
    expect(hasClaimInfo((await getList(molly, id)).items[0])).toBe(false);
  });

  // ---------------------------------------------------------------- links

  it("shows link visitors the wanted gifts and nothing about claims", async () => {
    const { id, item } = await mollysList();
    const got = await addItem(molly, id, "Already have");
    await setReceived(molly, got, true);
    await claimItem(dad, item);
    await createListLink(molly, id);
    const { links } = await sharingFor(molly, id);
    const page = await listByLink(links[0].token);
    expect(page?.items.map((i) => i.name)).toEqual(["Candle set"]);
    expect(JSON.stringify(page)).not.toMatch(/claim/i);
    await revokeListLink(molly, id, links[0].id);
    expect(await listByLink(links[0].token)).toBeNull();
  });

  // ---------------------------------------------------------------- sharing

  it("only shares with your own groups and the people in them", async () => {
    const id = await createList(stranger, { forMe: true, recipientName: "S", occasion: "christmas", date: "" });
    await expect(setSharing(stranger, id, { groupIds: [family], userIds: [], editorIds: [] })).rejects.toBeInstanceOf(
      InputError,
    );
    await expect(setSharing(stranger, id, { groupIds: [], userIds: [molly.id], editorIds: [] })).rejects.toBeInstanceOf(
      InputError,
    );
    const view = await sharingFor(stranger, id);
    expect(view.groups).toEqual([]);
    expect(view.people).toEqual([]);
  });

  it("sets sharing exactly, and removing someone takes effect at once", async () => {
    const { id } = await mollysList();
    await setSharing(molly, id, { groupIds: [], userIds: [aunt.id], editorIds: [] });
    expect((await getList(aunt, id)).role).toBe("contribute");
    await expect(getList(dad, id)).rejects.toBeInstanceOf(AccessDenied);
    await setSharing(molly, id, { groupIds: [], userIds: [], editorIds: [] });
    await expect(getList(aunt, id)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("offers last list's sharing as one tap, never applying it silently", async () => {
    await mollysList();
    const next = await createList(molly, { forMe: false, recipientName: "Pet", occasion: "birthday", date: "2027-05-01" });
    const before = await sharingFor(molly, next);
    expect(before.shared).toEqual([]);
    expect(before.suggestion?.names).toEqual(["Family"]);
    await expect(getList(dad, next)).rejects.toBeInstanceOf(AccessDenied);
    await shareLikeLast(molly, next);
    expect((await getList(dad, next)).role).toBe("contribute");
  });

  it("never carries claims into a brought-forward gift", async () => {
    const old = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2025-12-25" });
    await setSharing(molly, old, { groupIds: [family], userIds: [], editorIds: [] });
    const gift = await addItem(molly, old, "Boots");
    await admin.query(
      `insert into gyfte_claims (item_id, list_id, claimer_id, item_name, list_title) values ($1, $2, $3, 'Boots', 'x')`,
      [gift, old, dad.id],
    );
    const next = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2026-12-25" });
    await setSharing(molly, next, { groupIds: [family], userIds: [], editorIds: [] });
    await bringForward(molly, next, [gift]);
    expect((await getList(aunt, next)).items[0].claim).toBeNull();
  });
});
