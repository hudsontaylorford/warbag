import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { AccessDenied, addToGroup, type Actor } from "@/lib/access";
import { InputError } from "@/lib/errors";
import { getList } from "@/lib/gyfte/data";
import { claimItem } from "@/lib/gyfte/claims";
import { createGyfteGroup, groupPage } from "@/lib/gyfte/groups";
import { connectName, nameOnlyLists } from "@/lib/gyfte/connect";
import { setMyName } from "@/lib/account";
import { pool } from "@/lib/db";

let hudson: Actor, avery: Actor, aunt: Actor, otherAdmin: Actor, outsider: Actor;
let groupId: string, accessGroupId: string;

/** A name-only Christmas list in a group, shared with it, like the import makes. */
async function nameOnly(name: string, year: number, group = groupId, access = accessGroupId) {
  const { rows } = await admin.query<{ id: string }>(
    `insert into gyfte_lists (owner_id, recipient_name, occasion, occasion_date, group_id)
     values ($1, $2, 'christmas', $3, $4) returning id`,
    [hudson.id, name, `${year}-12-25`, group],
  );
  await admin.query(
    `insert into item_grants (app, item_type, item_id, group_id, role) values ('gyfte', 'list', $1, $2, 'contribute')`,
    [rows[0].id, access],
  );
  await admin.query(`insert into gyfte_items (list_id, name, position) values ($1, 'Socks', 0)`, [rows[0].id]);
  return rows[0].id;
}
const owners = async (ids: string[]) =>
  (await admin.query<{ owner_id: string; recipient_user_id: string | null }>(
    "select owner_id, recipient_user_id from gyfte_lists where id = any($1::uuid[]) order by occasion_date",
    [ids],
  )).rows;

describeDb("connecting name-only lists to people", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    otherAdmin = await makeUser({ isAdmin: true });
    avery = await makeUser();
    aunt = await makeUser();
    outsider = await makeUser();
    groupId = await createGyfteGroup(hudson, "Ford Family");
    accessGroupId = (await groupPage(hudson, groupId)).accessGroupId;
    for (const p of [avery, aunt]) await addToGroup(hudson, accessGroupId, p.id);
    await setMyName(avery, "Avery");
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("lists name-only lists to admins in the group, once per name", async () => {
    await nameOnly("Avery", 2024);
    await nameOnly("avery", 2025);
    await nameOnly("Sam", 2023);
    await expect(nameOnlyLists(aunt, groupId)).rejects.toBeInstanceOf(AccessDenied);
    await expect(nameOnlyLists(otherAdmin, groupId)).rejects.toBeInstanceOf(AccessDenied);
    const names = await nameOnlyLists(hudson, groupId);
    expect(names.map((n) => [n.name.toLowerCase(), n.lists, n.years])).toEqual([
      ["avery", 2, ["2024", "2025"]],
      ["sam", 1, ["2023"]],
    ]);
  });

  it("shows a name-only person with only past lists on the group page, opening the latest", async () => {
    await nameOnly("Sam", 2023);
    const latest = await nameOnly("Sam", 2024);
    const row = (await groupPage(aunt, groupId)).christmas.find((r) => r.name === "Sam");
    expect(row).toMatchObject({ list: null, latest: { id: latest, year: "2024" } });
  });

  it("connects every year to the person, in this group only; claims stay hidden from them", async () => {
    const year = Number((await groupPage(hudson, groupId)).year); // this Christmas, so it can be claimed
    const a = await nameOnly("Avery", year - 1);
    const b = await nameOnly("Avery", year);
    const other = await createGyfteGroup(hudson, "Other");
    const otherAccess = (await groupPage(hudson, other)).accessGroupId;
    const elsewhere = await nameOnly("Avery", year - 1, other, otherAccess);
    const item = (await admin.query<{ id: string }>("select id from gyfte_items where list_id = $1", [b])).rows[0].id;
    await claimItem(aunt, item);

    await expect(connectName(aunt, groupId, "Avery", avery.id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(connectName(otherAdmin, groupId, "Avery", avery.id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(connectName(hudson, groupId, "Avery", outsider.id)).rejects.toBeInstanceOf(InputError);

    expect(await connectName(hudson, groupId, "avery", avery.id)).toEqual({ lists: 2 });
    expect(await owners([a, b])).toEqual([
      { owner_id: avery.id, recipient_user_id: avery.id },
      { owner_id: avery.id, recipient_user_id: avery.id },
    ]);
    expect((await owners([elsewhere]))[0].recipient_user_id).toBeNull();
    expect(await nameOnlyLists(hudson, groupId)).toEqual([]);

    const mine = await getList(avery, b);
    expect(mine.role).toBe("manage");
    expect(mine.claims.visible).toBe(false);
    expect(mine.items[0].claim).toBeUndefined();
    expect((await getList(aunt, b)).items[0].claim).toMatchObject({ mine: true });

    const { rows } = await admin.query(`select action from audit_events where actor_id = $1 and action = 'gyfte.lists.connect'`, [hudson.id]);
    expect(rows).toHaveLength(1);
  });

  it("refuses when the person already has a list for the same Christmas, and changes nothing", async () => {
    const a = await nameOnly("Avery", 2024);
    const b = await nameOnly("Avery", 2025);
    await admin.query(
      `insert into gyfte_lists (owner_id, recipient_user_id, recipient_name, occasion, occasion_date, group_id)
       values ($1, $1, 'Avery', 'christmas', '2025-12-25', $2)`,
      [avery.id, groupId],
    );
    await expect(connectName(hudson, groupId, "Avery", avery.id)).rejects.toThrow(/already has a list for 2025/);
    expect((await owners([a, b])).map((r) => r.recipient_user_id)).toEqual([null, null]);
  });
});
