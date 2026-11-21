import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, addToGroup, type Actor } from "@/lib/access";
import { appsFor } from "@/lib/apps";
import { canOpenGyfte, getList, InputError, listsFor } from "@/lib/gyfte/data";
import { myClaims } from "@/lib/gyfte/claims";
import {
  createGyfteGroup,
  createSampleFamily,
  deleteSampleFamily,
  groupPage,
  myGroups,
  startMyGroupList,
  viewerFor,
} from "@/lib/gyfte/groups";
import { setMyName } from "@/lib/account";
import { pool } from "@/lib/db";

let hudson: Actor, molly: Actor, outsider: Actor;
const thisYear = () => {
  const d = new Date();
  // Same rule as the app: this year's Christmas until it's two weeks past.
  return String(d.getUTCMonth() === 0 && d.getUTCDate() <= 8 ? d.getUTCFullYear() - 1 : d.getUTCFullYear());
};

describeDb("gyfte groups and the sample family", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    molly = await makeUser();
    outsider = await makeUser();
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("lets only admins create groups, and makes the admin a member", async () => {
    await expect(createGyfteGroup(molly, "Mine")).rejects.toBeInstanceOf(AccessDenied);
    const id = await createGyfteGroup(hudson, "Ford Family");
    expect((await myGroups(hudson)).map((g) => g.name)).toEqual(["Ford Family"]);
    expect((await groupPage(hudson, id)).christmas.map((r) => r.isYou)).toEqual([true]);
  });

  it("shows a group only to its members; members can open Gyfte and start their own list there", async () => {
    const id = await createGyfteGroup(hudson, "Ford Family");
    const page = await groupPage(hudson, id);
    await expect(groupPage(outsider, id)).rejects.toBeInstanceOf(AccessDenied);

    await addToGroup(hudson, page.accessGroupId, molly.id);
    expect(await canOpenGyfte(molly)).toBe(true);
    expect((await appsFor(molly)).map((a) => a.id)).toContain("gyfte");

    await expect(startMyGroupList(molly, id, page.year)).rejects.toBeInstanceOf(InputError); // no name yet
    await setMyName(molly, "Molly");
    const listId = await startMyGroupList(molly, id, page.year);
    expect(await startMyGroupList(molly, id, page.year)).toBe(listId); // no duplicates

    const seen = await groupPage(hudson, id);
    expect(seen.christmas.find((r) => r.userId === molly.id)?.list?.id).toBe(listId);
    expect((await getList(hudson, listId)).claims.canClaim).toBe(true);
    expect((await getList(molly, listId)).claims.visible).toBe(false);
  });

  it("builds a sample family with years, a kid, and claims, kept off your own Lists page", async () => {
    const id = await createSampleFamily(hudson);
    expect(await createSampleFamily(hudson)).toBe(id); // one at a time
    const page = await groupPage(hudson, id);
    expect(page.isSample).toBe(true);
    expect(page.years).toEqual([String(Number(thisYear()) - 1), thisYear()]);
    expect(page.christmas.map((r) => r.name)).toContain("Sample Kid");
    expect(page.christmas.filter((r) => r.list).length).toBe(8); // 5 adults, 2 kids, 1 joint list
    expect(page.samplePeople).toHaveLength(5);
    expect((await listsFor(hudson)).current).toEqual([]);
  });

  it("lets an admin view as a made-up person: their own claims hidden, others' shown", async () => {
    const id = await createSampleFamily(hudson);
    const page = await groupPage(hudson, id);
    const mom = page.samplePeople.find((p) => p.name === "Sample Mom")!;
    const { viewer, previewName } = await viewerFor(hudson, mom.id);
    expect(previewName).toBe("Sample Mom");

    const asMom = await groupPage(viewer, id);
    const momsList = asMom.christmas.find((r) => r.name === "Sample Mom")!.list!;
    const kidsList = asMom.christmas.find((r) => r.name === "Sample Kid")!.list!;
    const own = await getList(viewer, momsList.id);
    expect(own.claims.visible).toBe(false);
    for (const item of own.items) expect("claim" in item).toBe(false);
    const kid = await getList(viewer, kidsList.id);
    expect(kid.items.some((i) => i.claim)).toBe(true); // parent sees claims on the kid's list
    expect((await myClaims(viewer)).length).toBeGreaterThan(0);
  });

  it("never lets anyone view as a real person, or non-admins view as anyone", async () => {
    const id = await createSampleFamily(hudson);
    const someone = (await groupPage(hudson, id)).samplePeople[0];
    expect((await viewerFor(hudson, molly.id)).viewer.id).toBe(hudson.id);
    expect((await viewerFor(molly, someone.id)).viewer.id).toBe(molly.id);
    expect((await viewerFor(hudson, "not-a-user")).previewName).toBeNull();
  });

  it("deletes the sample family completely, and only sample groups", async () => {
    const id = await createSampleFamily(hudson);
    const real = await createGyfteGroup(hudson, "Real family");
    await expect(deleteSampleFamily(hudson, real)).rejects.toBeInstanceOf(AccessDenied);
    await expect(deleteSampleFamily(molly, id)).rejects.toBeInstanceOf(AccessDenied);

    const page = await groupPage(hudson, id);
    const people = page.samplePeople.map((p) => p.id);
    const lists = [...page.christmas, ...page.birthdays].flatMap((r) => (r.list ? [r.list.id] : []));

    await deleteSampleFamily(hudson, id);
    const left = await admin.query(
      `select (select count(*)::int from "user" where id = any($1::text[])) as people,
              (select count(*)::int from gyfte_groups where id = $2) as groups,
              (select count(*)::int from groups where id = $3) as "accessGroups",
              (select count(*)::int from gyfte_lists where id = any($4::uuid[])) as lists,
              (select count(*)::int from gyfte_claims where list_id = any($4::uuid[])) as claims,
              (select count(*)::int from item_grants where item_id = any($4::text[])) as grants`,
      [people, id, page.accessGroupId, lists],
    );
    expect(left.rows[0]).toEqual({ people: 0, groups: 0, accessGroups: 0, lists: 0, claims: 0, grants: 0 });
    expect((await myGroups(hudson)).map((g) => g.name)).toEqual(["Real family"]);
  });
});
