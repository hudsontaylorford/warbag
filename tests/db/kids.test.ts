import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, addToGroup, type Actor } from "@/lib/access";
import { addItem, copyForward, getList, InputError, listsFor, setStarred, yearsOf } from "@/lib/gyfte/data";
import { claimItem } from "@/lib/gyfte/claims";
import { createGyfteGroup, createSampleFamily, deleteSampleFamily, groupPage } from "@/lib/gyfte/groups";
import { addKid, addKidParent, kidsOfList, myKids, renameKid, startKidList } from "@/lib/gyfte/kids";
import { removePerson } from "@/lib/people";
import { setMyName } from "@/lib/account";
import { pool } from "@/lib/db";

let hudson: Actor, mom: Actor, dad: Actor, aunt: Actor, outsider: Actor;
let groupId: string, year: string;

describeDb("kids", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    mom = await makeUser();
    dad = await makeUser();
    aunt = await makeUser();
    outsider = await makeUser();
    groupId = await createGyfteGroup(hudson, "Family");
    const page = await groupPage(hudson, groupId);
    year = page.year;
    for (const p of [mom, dad, aunt]) await addToGroup(hudson, page.accessGroupId, p.id);
    await setMyName(mom, "Mom");
    await setMyName(dad, "Dad");
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("lets a group member add their kid, and only parents change the kid", async () => {
    await expect(addKid(outsider, groupId, "Lennox")).rejects.toBeInstanceOf(AccessDenied);
    const kid = await addKid(mom, groupId, "  Lennox ");
    expect((await myKids(mom)).map((k) => [k.name, k.parents.map((p) => p.name)])).toEqual([["Lennox", ["Mom"]]]);
    await expect(renameKid(dad, kid, "X")).rejects.toBeInstanceOf(AccessDenied);
    await renameKid(mom, kid, "Lennox F");
    await expect(addKid(mom, groupId, " ")).rejects.toBeInstanceOf(InputError);
  });

  it("starts a kid's list in the group: family can claim, parents see claims, other parents can edit", async () => {
    const kid = await addKid(mom, groupId, "Lennox");
    await addKidParent(mom, kid, dad.id);
    await expect(startKidList(aunt, groupId, [kid], year)).rejects.toBeInstanceOf(AccessDenied);

    const listId = await startKidList(mom, groupId, [kid], year);
    expect(await startKidList(dad, groupId, [kid], year)).toBe(listId); // one per year
    expect(await kidsOfList(listId)).toEqual([kid]);

    const toy = await addItem(dad, listId, "Toy train"); // co-parent edits
    await claimItem(aunt, toy);
    expect((await getList(mom, listId)).items[0].claim).toEqual({ mine: false, by: null });
    expect((await getList(dad, listId)).items[0].claim).toEqual({ mine: false, by: null });
    expect((await getList(aunt, listId)).role).toBe("contribute");
  });

  it("gives a parent added later edit rights on the kid's existing lists", async () => {
    const kid = await addKid(mom, groupId, "Lennox");
    const listId = await startKidList(mom, groupId, [kid], year);
    const item = await addItem(mom, listId, "Book");
    await expect(setStarred(dad, item, true)).rejects.toBeInstanceOf(AccessDenied);
    await expect(addKidParent(mom, kid, outsider.id)).rejects.toBeInstanceOf(InputError);
    await addKidParent(mom, kid, dad.id);
    await setStarred(dad, item, true);
    expect((await getList(dad, listId)).role).toBe("manage");
  });

  it("keeps a joint list separate, so a shared gift is claimed once", async () => {
    const a = await addKid(mom, groupId, "Eleanor");
    const b = await addKid(mom, groupId, "Genevieve");
    const joint = await startKidList(mom, groupId, [a, b], year);
    const own = await startKidList(mom, groupId, [a], year);
    expect(joint).not.toBe(own);
    expect(await startKidList(mom, groupId, [b, a], year)).toBe(joint);
    const tent = await addItem(mom, joint, "Play tent");
    await claimItem(aunt, tent);
    await expect(claimItem(dad, tent)).rejects.toBeInstanceOf(InputError);

    const page = await groupPage(mom, groupId);
    const momAt = page.christmas.findIndex((r) => r.userId === mom.id);
    expect(page.christmas.slice(momAt + 1, momAt + 4).map((r) => [r.name, r.nested])).toEqual([
      ["Eleanor", true],
      ["Genevieve", true],
      ["Eleanor & Genevieve (together)", true],
    ]);
    expect(page.hasJointForMyKids).toBe(true);
    expect(page.christmas.find((r) => r.name === "Genevieve")?.canStart).toBe(true);
    expect((await groupPage(aunt, groupId)).christmas.find((r) => r.name === "Genevieve")?.canStart).toBe(false);
  });

  it("links a kid's years and copies forward, whichever parent started each list", async () => {
    const kid = await addKid(mom, groupId, "Lennox");
    await addKidParent(mom, kid, dad.id);
    const old = await admin.query<{ id: string }>(
      `insert into gyfte_lists (owner_id, recipient_name, occasion, occasion_date, group_id) values ($1, 'Lennox', 'christmas', '2024-12-25', $2) returning id`,
      [mom.id, groupId],
    );
    await admin.query("insert into gyfte_list_kids (list_id, kid_id) values ($1, $2)", [old.rows[0].id, kid]);
    await admin.query(
      `insert into item_grants (app, item_type, item_id, user_id, role) values ('gyfte', 'list', $1, $2, 'manage')`,
      [old.rows[0].id, dad.id],
    );
    const gift = await admin.query<{ id: string }>(
      `insert into gyfte_items (list_id, name, position) values ($1, 'Blocks', 0) returning id`,
      [old.rows[0].id],
    );

    // The co-parent sees Copy to this year, with the group it lands in; others don't.
    expect((await getList(dad, old.rows[0].id))).toMatchObject({ canCopyForward: true, groupName: "Family" });
    await admin.query(
      `insert into item_grants (app, item_type, item_id, user_id, role) values ('gyfte', 'list', $1, $2, 'manage')`,
      [old.rows[0].id, aunt.id],
    );
    expect((await getList(aunt, old.rows[0].id)).canCopyForward).toBe(false); // manager, not a parent
    await expect(copyForward(aunt, old.rows[0].id, [gift.rows[0].id])).rejects.toBeInstanceOf(AccessDenied);
    const copied = await copyForward(dad, old.rows[0].id, [gift.rows[0].id]); // co-parent copies
    expect(await kidsOfList(copied.listId)).toEqual([kid]);
    expect((await getList(mom, copied.listId)).items.map((i) => i.name)).toEqual(["Blocks"]);
    expect((await yearsOf(mom, copied.listId)).map((y) => y.year)).toEqual(["2024", year]);
    expect((await getList(aunt, copied.listId)).role).toBe("contribute"); // still in the group
  });

  it("puts a kid's list under My list for both parents, and under Family for everyone else", async () => {
    const kid = await addKid(mom, groupId, "Lennox");
    await addKidParent(mom, kid, dad.id);
    const listId = await startKidList(mom, groupId, [kid], year);
    const seen = async (a: Actor) => (await listsFor(a)).current.find((l) => l.id === listId);
    expect(await seen(mom)).toMatchObject({ canManage: true, inMyGroup: true });
    expect(await seen(dad)).toMatchObject({ canManage: true, inMyGroup: true });
    expect(await seen(aunt)).toMatchObject({ canManage: false, inMyGroup: true });
    expect(await seen(outsider)).toBeUndefined();
  });

  it("names with no list this year open their latest earlier list, if the viewer may see it", async () => {
    const kid = await addKid(mom, groupId, "Lennox");
    const access = (await groupPage(hudson, groupId)).accessGroupId;
    const old = async (name: string, recipient: string | null, date: string, shared: boolean) => {
      const { rows } = await admin.query<{ id: string }>(
        `insert into gyfte_lists (owner_id, recipient_user_id, recipient_name, occasion, occasion_date, group_id)
         values ($1, $2, $3, 'christmas', $4, $5) returning id`,
        [mom.id, recipient, name, date, groupId],
      );
      if (shared) {
        await admin.query(
          `insert into item_grants (app, item_type, item_id, group_id, role) values ('gyfte', 'list', $1, $2, 'contribute')`,
          [rows[0].id, access],
        );
      }
      return rows[0].id;
    };
    await old("Mom", mom.id, "2023-12-25", true);
    const mom2024 = await old("Mom", mom.id, "2024-12-25", true);
    const kid2024 = await old("Lennox", null, "2024-12-25", true);
    await admin.query("insert into gyfte_list_kids (list_id, kid_id) values ($1, $2)", [kid2024, kid]);
    await old("Dad", dad.id, "2024-12-25", false); // not shared with the group

    const page = await groupPage(aunt, groupId);
    const row = (name: string) => page.christmas.find((r) => r.name === name)!;
    expect(row("Mom")).toMatchObject({ list: null, latest: { id: mom2024, year: "2024" } });
    expect(row("Lennox")).toMatchObject({ list: null, latest: { id: kid2024, year: "2024" } });
    expect(row("Dad").latest).toBeNull(); // aunt can't see Dad's old list
  });

  it("hands a removed parent's kid lists to the other parent", async () => {
    const kid = await addKid(mom, groupId, "Lennox");
    await addKidParent(mom, kid, dad.id);
    const listId = await startKidList(mom, groupId, [kid], year);
    await removePerson(hudson, mom.id);
    const { rows } = await admin.query("select owner_id from gyfte_lists where id = $1", [listId]);
    expect(rows[0].owner_id).toBe(dad.id);
  });

  it("gives the sample family two kids with both parents and a joint list, and deletes the kids too", async () => {
    const id = await createSampleFamily(hudson);
    const page = await groupPage(hudson, id);
    const nested = page.christmas.filter((r) => r.nested).map((r) => r.name);
    expect(nested).toEqual(["Sample Baby", "Sample Kid", "Sample Baby & Sample Kid (together)"]);
    const kidIds = (
      await admin.query<{ id: string }>(
        `select k.id from gyfte_kids k join gyfte_kid_parents p on p.kid_id = k.id
         join sample_people s on s.user_id = p.user_id where s.gyfte_group_id = $1`,
        [id],
      )
    ).rows.map((r) => r.id);
    expect(new Set(kidIds).size).toBe(2);
    await deleteSampleFamily(hudson, id);
    const left = await admin.query("select 1 from gyfte_kids where id = any($1::uuid[])", [kidIds]);
    expect(left.rowCount).toBe(0);
  });

  it("shows your kids in each of your groups, but never in a sample family", async () => {
    await addKid(hudson, groupId, "Real Kid");
    const other = await createGyfteGroup(hudson, "Other family");
    expect((await groupPage(hudson, other)).christmas.map((r) => r.name)).toContain("Real Kid");
    const sample = await createSampleFamily(hudson);
    expect((await groupPage(hudson, sample)).christmas.map((r) => r.name)).not.toContain("Real Kid");
  });
});
