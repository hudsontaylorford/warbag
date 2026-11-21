import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, addToGroup, type Actor } from "@/lib/access";
import { getList, InputError } from "@/lib/gyfte/data";
import { createGyfteGroup, groupPage } from "@/lib/gyfte/groups";
import { addKid } from "@/lib/gyfte/kids";
import { applyImportDraft, createImportDraft, getImportDraft } from "@/lib/gyfte/imports";
import { setMyName } from "@/lib/account";
import { pool } from "@/lib/db";
import { giftSheetBuffer } from "../support/gift-sheet";
import type { TabPlan } from "@/lib/gyfte/import-plan";

let hudson: Actor, avery: Actor, parent: Actor, outsider: Actor;
let groupId: string;

const draft = async (actor: Actor) => {
  const id = await createImportDraft(actor, "family.xlsx", await giftSheetBuffer({ siblings: true }));
  const sheet = (await getImportDraft(actor, id)).sheet;
  const keys = sheet.lists.flatMap((l) => l.items.filter((i) => i.include).map((i) => i.key));
  return { id, sheet, keys };
};

describeDb("importing into a group: who each tab is", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    avery = await makeUser();
    parent = await makeUser();
    outsider = await makeUser();
    await setMyName(hudson, "Sam");
    await setMyName(parent, "Pat");
    groupId = await createGyfteGroup(hudson, "Family");
    const { accessGroupId } = await groupPage(hudson, groupId);
    await addToGroup(hudson, accessGroupId, avery.id);
    await addToGroup(hudson, accessGroupId, parent.id);
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("files each tab as me, a member, or split between kids with a joint list", async () => {
    const { id, sheet, keys } = await draft(hudson);
    const kidRows = sheet.lists.find((l) => l.person === "Kit and Lou")!.items;
    const [scooter, kitchen, books] = kidRows.map((i) => i.key);
    const tabs: Record<string, TabPlan> = {
      Sam: { who: "me" },
      Avery: { who: "member", userId: avery.id },
      "Kit and Lou": { who: "split", parentId: parent.id, kids: ["Kit", "Lou"], rows: { [scooter]: "Kit", [kitchen]: "both" } },
    };
    const result = await applyImportDraft(hudson, id, { keep: keys.filter((k) => k !== books), plan: { groupId, tabs } });
    expect(result.lists).toBe(7); // Sam 2, Avery 3, Kit 1, joint 1

    const lists = await admin.query(
      `select l.recipient_name, l.owner_id, l.recipient_user_id, l.group_id,
         (select count(*)::int from gyfte_list_kids k where k.list_id = l.id) as kids,
         (select array_agg(name order by position) from gyfte_items i where i.list_id = l.id) as gifts
       from gyfte_lists l where l.group_id = $1 order by l.recipient_name, l.occasion_date`,
      [groupId],
    );
    const by = (name: string) => lists.rows.filter((r) => r.recipient_name === name);
    expect(by("Avery")).toHaveLength(3);
    expect(by("Avery").every((r) => r.owner_id === avery.id && r.recipient_user_id === avery.id)).toBe(true);
    expect(by("Sam").every((r) => r.owner_id === hudson.id && r.recipient_user_id === hudson.id)).toBe(true);
    expect(by("Kit")).toEqual([expect.objectContaining({ owner_id: parent.id, kids: 1, gifts: ["Scooter"] })]);
    expect(by("Kit & Lou")).toEqual([expect.objectContaining({ owner_id: parent.id, kids: 2, gifts: ["Play kitchen"] })]);
    expect(by("Lou")).toEqual([]); // nothing was given to Lou alone

    // Shared with the group, and the member owns their own history.
    const avery2025 = by("Avery").at(-1);
    const { rows } = await admin.query("select id from gyfte_lists where recipient_name = 'Avery' and group_id = $1 order by occasion_date desc", [groupId]);
    expect((await getList(avery, rows[0].id)).role).toBe("manage");
    expect((await getList(parent, rows[0].id)).role).toBe("contribute");
    expect(avery2025).toBeTruthy();
  });

  it("reuses a kid the parent already has, and can make a single kid from a tab", async () => {
    const existing = await addKid(parent, groupId, "Avery");
    const { id, keys } = await draft(hudson);
    await applyImportDraft(hudson, id, {
      keep: keys,
      plan: { groupId, tabs: { Avery: { who: "kid", parentId: parent.id, kidName: "avery" }, Sam: { who: "skip" }, "Kit and Lou": { who: "skip" } } },
    });
    const { rows } = await admin.query(
      `select distinct lk.kid_id from gyfte_list_kids lk join gyfte_lists l on l.id = lk.list_id where l.group_id = $1`,
      [groupId],
    );
    expect(rows.map((r) => r.kid_id)).toEqual([existing]);
  });

  it("skips lists that already exist when importing again", async () => {
    const tabs: Record<string, TabPlan> = { Sam: { who: "me" }, Avery: { who: "member", userId: avery.id }, "Kit and Lou": { who: "skip" } };
    const first = await draft(hudson);
    await applyImportDraft(hudson, first.id, { keep: first.keys, plan: { groupId, tabs } });
    const second = await draft(hudson);
    expect(await applyImportDraft(hudson, second.id, { keep: second.keys, plan: { groupId, tabs } })).toEqual({ lists: 0, gifts: 0 });
  });

  it("refuses choices outside the group or that don't make sense", async () => {
    const { id, keys } = await draft(hudson);
    const tryPlan = (gid: string | null, tabs: Record<string, TabPlan>) =>
      applyImportDraft(hudson, id, { keep: keys, plan: { groupId: gid, tabs } });
    await expect(tryPlan(groupId, { Avery: { who: "member", userId: outsider.id } })).rejects.toBeInstanceOf(InputError);
    await expect(tryPlan(groupId, { Avery: { who: "kid", parentId: outsider.id, kidName: "A" } })).rejects.toBeInstanceOf(InputError);
    await expect(
      tryPlan(groupId, { "Kit and Lou": { who: "split", parentId: parent.id, kids: ["Kit"], rows: {} } }),
    ).rejects.toBeInstanceOf(InputError);
    await expect(tryPlan(null, { Avery: { who: "member", userId: avery.id } })).rejects.toBeInstanceOf(InputError);
    const notMine = await createGyfteGroup(await makeUser({ isAdmin: true }), "Other");
    await expect(tryPlan(notMine, {})).rejects.toBeInstanceOf(AccessDenied);
    // Nothing was written by the refused attempts.
    const { rowCount } = await admin.query("select 1 from gyfte_lists where group_id = $1", [groupId]);
    expect(rowCount).toBe(0);
  });
});
