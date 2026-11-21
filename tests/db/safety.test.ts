import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { addToGroup, createGroup, grantApp, hasItemGrants, type Actor } from "@/lib/access";
import { appsFor } from "@/lib/apps";
import {
  AccessDenied,
  addItem,
  canOpenGyfte,
  canUseGyfte,
  createList,
  getList,
  listsFor,
  updateItem,
} from "@/lib/gyfte/data";
import { claimItem, dismissClaim, myClaims } from "@/lib/gyfte/claims";
import { setSharing } from "@/lib/gyfte/sharing";
import { removalImpact, removePerson } from "@/lib/people";
import { pool } from "@/lib/db";

let hudson: Actor, molly: Actor, aunt: Actor;
let family: string;

describeDb("safety fixes", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    molly = await makeUser();
    aunt = await makeUser(); // in the family, but no Gyfte app access
    family = await createGroup(hudson, "Family");
    for (const p of [hudson, molly, aunt]) await addToGroup(hudson, family, p.id);
    await grantApp(hudson, "gyfte", { userId: molly.id });
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  async function mollysSharedList() {
    const id = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "" });
    await setSharing(molly, id, { groupIds: [family], userIds: [], editorIds: [] });
    const item = await addItem(molly, id, "Wool scarf");
    return { id, item };
  }

  // ---------------------------------------------------------------- shared lists without app access

  it("lets someone open Gyfte for a list shared with them, without letting them make lists", async () => {
    expect(await canOpenGyfte(aunt)).toBe(false);
    expect((await appsFor(aunt)).map((a) => a.id)).not.toContain("gyfte");

    const { id } = await mollysSharedList();
    expect(await hasItemGrants(aunt, "gyfte")).toBe(true);
    expect(await canOpenGyfte(aunt)).toBe(true);
    expect(await canUseGyfte(aunt)).toBe(false);
    expect((await appsFor(aunt)).map((a) => a.id)).toContain("gyfte");
    expect((await listsFor(aunt)).current.map((l) => l.id)).toEqual([id]);
    expect((await getList(aunt, id)).claims.canClaim).toBe(true);
    await expect(
      createList(aunt, { forMe: true, recipientName: "Aunt", occasion: "christmas", date: "" }),
    ).rejects.toBeInstanceOf(AccessDenied);
  });

  // ---------------------------------------------------------------- removing a person

  it("moves a removed person's lists to the admin instead of deleting them", async () => {
    const mine = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "" });
    await addItem(molly, mine, "Scarf");
    const kid = await createList(molly, { forMe: false, recipientName: "Kid", occasion: "christmas", date: "" });
    await addItem(molly, kid, "Blocks");
    expect(await removalImpact(hudson, molly.id)).toEqual({ lists: 2, claims: 0 });

    await removePerson(hudson, molly.id);
    const { rows } = await admin.query(
      "select owner_id, recipient_user_id, recipient_name from gyfte_lists where id = any($1::uuid[]) order by recipient_name",
      [[mine, kid]],
    );
    expect(rows).toEqual([
      { owner_id: hudson.id, recipient_user_id: null, recipient_name: "Kid" },
      { owner_id: hudson.id, recipient_user_id: null, recipient_name: "Molly" },
    ]);
    expect((await getList(hudson, kid)).items.map((i) => i.name)).toEqual(["Blocks"]);
  });

  it("frees the gifts a removed person claimed, and says so first", async () => {
    const { id, item } = await mollysSharedList();
    await claimItem(aunt, item);
    expect(await removalImpact(hudson, aunt.id)).toEqual({ lists: 0, claims: 1 });
    await removePerson(hudson, aunt.id);
    expect((await getList(hudson, id)).items[0].claim).toBeNull();
  });

  // ---------------------------------------------------------------- my claims after losing access

  it("freezes a claim at what you saw once the list is no longer shared with you", async () => {
    const { id, item } = await mollysSharedList();
    await claimItem(aunt, item);
    expect((await myClaims(aunt))[0]).toMatchObject({ itemName: "Wool scarf", lostAccess: false, listId: id });

    await setSharing(molly, id, { groupIds: [], userIds: [], editorIds: [] });
    await updateItem(molly, item, { name: "Cashmere scarf", notes: "", size: "", color: "", price: "", links: ["https://shop.example.com/scarf"] });

    const [claim] = await myClaims(aunt);
    expect(claim).toMatchObject({ itemName: "Wool scarf", link: null, listId: null, itemId: null, received: false, lostAccess: true });
    expect(JSON.stringify(claim)).not.toContain("Cashmere");

    await dismissClaim(aunt, claim.id);
    expect(await myClaims(aunt)).toEqual([]);
  });

  it("doesn't let Clear remove a claim you can still see (that's Undo)", async () => {
    const { item } = await mollysSharedList();
    await claimItem(aunt, item);
    const [claim] = await myClaims(aunt);
    await dismissClaim(aunt, claim.id);
    expect(await myClaims(aunt)).toHaveLength(1);
  });
});
