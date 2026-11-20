import { afterAll, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { APPS, appsFor, hostOf } from "@/lib/apps";
import { addToGroup, createGroup, grantApp } from "@/lib/access";
import { pool } from "@/lib/db";

describeDb("app registry", () => {
  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  it("has unique ids that fit the access rules", () => {
    const ids = APPS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]{0,39}$/);
  });

  it("shows admins every app and others only what they were given", async () => {
    const hudson = await makeUser({ isAdmin: true });
    const molly = await makeUser();
    const friend = await makeUser();

    expect((await appsFor(hudson)).map((a) => a.id)).toEqual(APPS.map((a) => a.id));
    expect(await appsFor(molly)).toEqual([]);

    await grantApp(hudson, "gyfte", { userId: molly.id });
    expect((await appsFor(molly)).map((a) => a.id)).toEqual(["gyfte"]);

    const family = await createGroup(hudson, "Family");
    await addToGroup(hudson, family, friend.id);
    await grantApp(hudson, "chirk", { groupId: family });
    expect((await appsFor(friend)).map((a) => a.id)).toEqual(["chirk"]);
  });

  it("names where external links go", () => {
    expect(hostOf("https://chirk.fyi")).toBe("chirk.fyi");
    expect(hostOf("https://www.example.com/a")).toBe("example.com");
  });
});
