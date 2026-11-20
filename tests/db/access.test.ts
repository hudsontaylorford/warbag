import { afterAll, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { admin, describeDb, makeUser } from "../support/db";
import {
  AccessDenied,
  addToGroup,
  canUseApp,
  createGroup,
  createShareLink,
  deleteGroup,
  forgetItem,
  grantApp,
  grantItem,
  groupsFor,
  itemRole,
  itemsSharedWith,
  listItemGrants,
  listShareLinks,
  removeFromGroup,
  requireItemRole,
  resolveShareLink,
  revokeApp,
  revokeItem,
  revokeShareLink,
  type Actor,
  type ItemRef,
} from "@/lib/access";
import { pool } from "@/lib/db";

type User = Actor;
let owner: User, hudson: User, molly: User, friend: User;
let list: ItemRef;

describeDb("access rules", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    owner = await makeUser();
    molly = await makeUser();
    friend = await makeUser();
    list = { app: "gyfte", type: "list", id: randomUUID(), ownerId: owner.id };
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  // ------------------------------------------------------------ items

  it("gives the owner manage and everyone else nothing by default", async () => {
    expect(await itemRole(owner, list)).toBe("manage");
    expect(await itemRole(molly, list)).toBeNull();
    expect(await itemRole(null, list)).toBeNull();
  });

  it("does not let admins into other people's items", async () => {
    expect(await itemRole(hudson, list)).toBeNull();
    await expect(requireItemRole(hudson, list, "view")).rejects.toBeInstanceOf(AccessDenied);
  });

  it("shares an item with a person at a level, and changes or removes it", async () => {
    await grantItem(owner, list, { userId: molly.id }, "view");
    expect(await itemRole(molly, list)).toBe("view");

    await grantItem(owner, list, { userId: molly.id }, "contribute");
    expect(await itemRole(molly, list)).toBe("contribute");
    expect(await listItemGrants(owner, list)).toHaveLength(1);

    await revokeItem(owner, list, { userId: molly.id });
    expect(await itemRole(molly, list)).toBeNull();
  });

  it("only lets managers change who has access", async () => {
    await grantItem(owner, list, { userId: molly.id }, "contribute");
    await expect(grantItem(molly, list, { userId: friend.id }, "view")).rejects.toBeInstanceOf(AccessDenied);
    await expect(revokeItem(molly, list, { userId: molly.id })).rejects.toBeInstanceOf(AccessDenied);
    await expect(listItemGrants(molly, list)).rejects.toBeInstanceOf(AccessDenied);
    await expect(createShareLink(molly, list)).rejects.toBeInstanceOf(AccessDenied);

    // A manager who isn't the owner can share onward.
    await grantItem(owner, list, { userId: molly.id }, "manage");
    await grantItem(molly, list, { userId: friend.id }, "view");
    expect(await itemRole(friend, list)).toBe("view");
  });

  it("keeps grants on one item from leaking to another", async () => {
    await grantItem(owner, list, { userId: molly.id }, "manage");
    const other: ItemRef = { ...list, id: randomUUID() };
    expect(await itemRole(molly, other)).toBeNull();
    const otherType: ItemRef = { ...list, type: "note" };
    expect(await itemRole(molly, otherType)).toBeNull();
  });

  it("lists items shared with someone, with their best level", async () => {
    const family = await createGroup(hudson, "Family");
    await addToGroup(hudson, family, molly.id);
    await addToGroup(hudson, family, owner.id);
    await grantItem(owner, list, { groupId: family }, "view");
    await grantItem(owner, list, { userId: molly.id }, "contribute");
    expect(await itemsSharedWith(molly, "gyfte", "list")).toEqual([{ id: list.id, role: "contribute" }]);
    expect(await itemsSharedWith(friend, "gyfte", "list")).toEqual([]);
  });

  it("forgets every grant and link when an item is deleted", async () => {
    await grantItem(owner, list, { userId: molly.id }, "view");
    const link = await createShareLink(owner, list);
    await forgetItem(owner, list);
    expect(await itemRole(molly, list)).toBeNull();
    expect(await resolveShareLink(link.token)).toBeNull();
  });

  // ------------------------------------------------------------ groups

  it("shares through a group, and removal takes effect immediately", async () => {
    const family = await createGroup(hudson, "Family");
    await addToGroup(hudson, family, molly.id);
    await addToGroup(hudson, family, owner.id);
    await grantItem(owner, list, { groupId: family }, "contribute");
    expect(await itemRole(molly, list)).toBe("contribute");
    expect(await itemRole(friend, list)).toBeNull();

    await removeFromGroup(hudson, family, molly.id);
    expect(await itemRole(molly, list)).toBeNull();
  });

  it("drops a group's grants when the group is deleted", async () => {
    const family = await createGroup(hudson, "Family");
    await addToGroup(hudson, family, molly.id);
    await addToGroup(hudson, family, owner.id);
    await grantItem(owner, list, { groupId: family }, "view");
    await deleteGroup(hudson, family);
    expect(await itemRole(molly, list)).toBeNull();
  });

  it("only lets admins manage groups", async () => {
    await expect(createGroup(molly, "Mine")).rejects.toBeInstanceOf(AccessDenied);
    const family = await createGroup(hudson, "Family");
    await expect(addToGroup(molly, family, molly.id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(removeFromGroup(molly, family, owner.id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(deleteGroup(molly, family)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("shows people only the groups they're in, and only lets them share with those", async () => {
    const family = await createGroup(hudson, "Family");
    const friends = await createGroup(hudson, "Friends");
    await addToGroup(hudson, family, owner.id);

    const visible = (await groupsFor(owner)).map((g) => g.id);
    expect(visible).toContain(family);
    expect(visible).not.toContain(friends);

    await expect(grantItem(owner, list, { groupId: friends }, "view")).rejects.toBeInstanceOf(AccessDenied);
    await grantItem(owner, list, { groupId: family }, "view");
  });

  // ------------------------------------------------------------ apps

  it("opens apps to admins, granted people and granted groups only", async () => {
    expect(await canUseApp(hudson, "gyfte")).toBe(true);
    expect(await canUseApp(molly, "gyfte")).toBe(false);

    await grantApp(hudson, "gyfte", { userId: molly.id });
    expect(await canUseApp(molly, "gyfte")).toBe(true);
    expect(await canUseApp(molly, "notes")).toBe(false);

    const family = await createGroup(hudson, "Family");
    await addToGroup(hudson, family, friend.id);
    await grantApp(hudson, "notes", { groupId: family });
    expect(await canUseApp(friend, "notes")).toBe(true);

    await revokeApp(hudson, "gyfte", { userId: molly.id });
    expect(await canUseApp(molly, "gyfte")).toBe(false);
    await removeFromGroup(hudson, family, friend.id);
    expect(await canUseApp(friend, "notes")).toBe(false);
  });

  it("only lets admins grant app access", async () => {
    await expect(grantApp(molly, "gyfte", { userId: molly.id })).rejects.toBeInstanceOf(AccessDenied);
    await expect(revokeApp(molly, "gyfte", { userId: owner.id })).rejects.toBeInstanceOf(AccessDenied);
  });

  // ------------------------------------------------------------ share links

  it("opens one item by link, without an account, and nothing else", async () => {
    const link = await createShareLink(owner, list);
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await itemRole(null, list, { linkToken: link.token })).toBe("view");

    const other: ItemRef = { ...list, id: randomUUID() };
    expect(await itemRole(null, other, { linkToken: link.token })).toBeNull();
  });

  it("combines a link with a person's own access, taking the higher", async () => {
    await grantItem(owner, list, { userId: molly.id }, "view");
    const link = await createShareLink(owner, list, { role: "contribute" });
    expect(await itemRole(molly, list, { linkToken: link.token })).toBe("contribute");
  });

  it("never lets a link grant manage", async () => {
    // @ts-expect-error manage isn't a link level
    await expect(createShareLink(owner, list, { role: "manage" })).rejects.toThrow();
  });

  it("stops a revoked link on the next request", async () => {
    const link = await createShareLink(owner, list);
    await revokeShareLink(owner, list, link.id);
    expect(await resolveShareLink(link.token)).toBeNull();
    expect(await itemRole(null, list, { linkToken: link.token })).toBeNull();
    expect(await listShareLinks(owner, list)).toHaveLength(0);
  });

  it("can't revoke a link through a different item", async () => {
    const link = await createShareLink(owner, list);
    const mine: ItemRef = { app: "gyfte", type: "list", id: randomUUID(), ownerId: molly.id };
    await revokeShareLink(molly, mine, link.id);
    expect(await resolveShareLink(link.token)).not.toBeNull();
  });

  it("stops an expired link", async () => {
    const link = await createShareLink(owner, list, { expiresAt: new Date(Date.now() + 60_000) });
    expect(await resolveShareLink(link.token)).not.toBeNull();
    await admin.query("update share_links set expires_at = now() - interval '1 second' where id = $1", [link.id]);
    expect(await resolveShareLink(link.token)).toBeNull();
  });

  it("rejects malformed and guessed tokens without a lookup error", async () => {
    expect(await resolveShareLink("")).toBeNull();
    expect(await resolveShareLink("' or 1=1 --")).toBeNull();
    expect(await resolveShareLink("A".repeat(32))).toBeNull();
  });

  it("ends a person's links when their account is deleted", async () => {
    const link = await createShareLink(owner, list);
    await admin.query(`delete from "user" where id = $1`, [owner.id]);
    expect(await resolveShareLink(link.token)).toBeNull();
  });

  // ------------------------------------------------------------ activity

  it("records who changed access", async () => {
    await grantItem(owner, list, { userId: molly.id }, "view");
    const { rows } = await admin.query(
      "select action, target from audit_events where actor_id = $1",
      [owner.id],
    );
    expect(rows).toEqual([{ action: "item.grant", target: `gyfte/list/${list.id}` }]);
  });
});
