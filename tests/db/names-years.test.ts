import { afterAll, beforeEach, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { grantApp, grantItem, type Actor } from "@/lib/access";
import { setMyName } from "@/lib/account";
import { InputError, createList, yearsOf } from "@/lib/gyfte/data";
import { pool } from "@/lib/db";

let hudson: Actor, molly: Actor;
const nameOf = async (id: string) => (await admin.query(`select name from "user" where id = $1`, [id])).rows[0].name;

describeDb("account names and list years", () => {
  beforeEach(async () => {
    hudson = await makeUser({ isAdmin: true });
    molly = await makeUser();
    await grantApp(hudson, "gyfte", { userId: molly.id });
  });

  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("sets your own display name, tidied and checked", async () => {
    expect(await setMyName(molly, "  Molly   Ford ")).toBe("Molly Ford");
    expect(await nameOf(molly.id)).toBe("Molly Ford");
    await expect(setMyName(molly, " ")).rejects.toBeInstanceOf(InputError);
    await expect(setMyName(molly, "x".repeat(81))).rejects.toBeInstanceOf(InputError);
  });

  it("names your account from your first list for yourself, but never overwrites a name", async () => {
    await createList(molly, { forMe: false, recipientName: "Kid", occasion: "christmas", date: "" });
    expect(await nameOf(molly.id)).toBe("");
    await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2025-12-25" });
    expect(await nameOf(molly.id)).toBe("Molly");
    await createList(molly, { forMe: true, recipientName: "Mol", occasion: "christmas", date: "2026-12-25" });
    expect(await nameOf(molly.id)).toBe("Molly");
  });

  it("links the same person's years for one occasion, oldest first", async () => {
    const make = (date: string, occasion = "christmas", forMe = true, name = "Molly") =>
      createList(molly, { forMe, recipientName: name, occasion, date });
    const c24 = await make("2024-12-25");
    const c25 = await make("2025-12-25");
    const c26 = await make("2026-12-25");
    await make("2026-03-14", "birthday");
    await make("2025-12-25", "christmas", false, "Kid");

    const years = await yearsOf(molly, c25);
    expect(years.map((y) => [y.year, y.current])).toEqual([
      ["2024", false],
      ["2025", true],
      ["2026", false],
    ]);
    expect(years.map((y) => y.id)).toEqual([c24, c25, c26]);
  });

  it("only shows years the viewer can open", async () => {
    const c24 = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2024-12-25" });
    const c25 = await createList(molly, { forMe: true, recipientName: "Molly", occasion: "christmas", date: "2025-12-25" });
    await grantItem(molly, { app: "gyfte", type: "list", id: c25, ownerId: molly.id }, { userId: hudson.id }, "view");
    expect((await yearsOf(hudson, c25)).map((y) => y.id)).toEqual([c25]);
    expect((await yearsOf(molly, c25)).map((y) => y.id)).toEqual([c24, c25]);
  });
});
