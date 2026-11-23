import { afterAll, expect, it } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { exportFile } from "../support/roomtune";
import { pool } from "@/lib/db";
import { AccessDenied, grantApp, revokeApp } from "@/lib/access";
import { appsFor } from "@/lib/apps";
import { InputError } from "@/lib/errors";
import { setupFromTemplate } from "@/lib/roomtune/setup";
import {
  createSetup,
  createSetupLink,
  deleteSetup,
  getSetup,
  importSetups,
  revokeSetupLink,
  saveSetup,
  setupByLink,
  setupLinks,
  setupsFor,
} from "@/lib/roomtune/setups";
import { readEqScreenshot } from "@/lib/roomtune/eq-ai";

describeDb("Room Tuner access", () => {
  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  async function people() {
    const hudson = await makeUser({ isAdmin: true });
    const friend = await makeUser();
    const other = await makeUser();
    await grantApp(hudson, "roomtune", { userId: friend.id });
    return { hudson, friend, other };
  }

  it("needs app access, which an admin turns on per person", async () => {
    const { hudson, friend, other } = await people();
    expect((await appsFor(friend)).map((a) => a.id)).toContain("roomtune");
    expect((await appsFor(other)).map((a) => a.id)).not.toContain("roomtune");
    await expect(setupsFor(other)).rejects.toBeInstanceOf(AccessDenied);
    await expect(createSetup(other, setupFromTemplate("Mine", "b5"))).rejects.toBeInstanceOf(AccessDenied);
    // Admins always have it.
    expect(await setupsFor(hudson)).toEqual([]);
  });

  it("keeps each setup private to its owner, admins included", async () => {
    const { hudson, friend } = await people();
    const id = await createSetup(friend, setupFromTemplate("Den soundbar", "b5"));
    expect((await setupsFor(friend)).map((s) => s.name)).toEqual(["Den soundbar"]);
    expect(await setupsFor(hudson)).not.toContainEqual(expect.objectContaining({ id }));
    await expect(getSetup(hudson, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(saveSetup(hudson, id, setupFromTemplate("Taken", "b5"))).rejects.toBeInstanceOf(AccessDenied);
    await expect(deleteSetup(hudson, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(getSetup(friend, "not-a-uuid")).rejects.toBeInstanceOf(AccessDenied);
    expect((await getSetup(friend, id)).name).toBe("Den soundbar");
  });

  it("stops working the moment app access is removed", async () => {
    const { hudson, friend } = await people();
    const id = await createSetup(friend, setupFromTemplate("Office", "b5"));
    await revokeApp(hudson, "roomtune", { userId: friend.id });
    await expect(getSetup(friend, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(saveSetup(friend, id, setupFromTemplate("Office", "b5"))).rejects.toBeInstanceOf(AccessDenied);
  });

  it("cleans what it saves", async () => {
    const { friend } = await people();
    const id = await createSetup(friend, setupFromTemplate("Bedroom", "b5"));
    await saveSetup(friend, id, { ...setupFromTemplate("  Bedroom 2  ", "b5"), currentEq: [99, 0, 0, 0, 0], sneaky: true });
    const s = await getSetup(friend, id);
    expect(s.name).toBe("Bedroom 2");
    expect(s.currentEq[0]).toBe(10);
    const { rows } = await admin.query("select doc from roomtune_setups where id = $1", [id]);
    expect(rows[0].doc).not.toHaveProperty("sneaky");
    await expect(saveSetup(friend, id, { name: "no bands" })).rejects.toBeInstanceOf(InputError);
  });

  it("imports an export file as new setups, all or nothing", async () => {
    const { friend } = await people();
    expect(await importSetups(friend, exportFile("Imported A"))).toBe(1);
    expect(await importSetups(friend, exportFile("Imported A"))).toBe(1); // a copy, not an overwrite
    const mine = (await setupsFor(friend)).filter((s) => s.name === "Imported A");
    expect(mine).toHaveLength(2);
    expect(mine[0]).toMatchObject({ bands: 5, rounds: 1 });
    const broken = JSON.stringify({ format: "room-tuner-setups", setups: { a: JSON.parse(exportFile("Fine")).setups.ex1, b: { name: "No bands" } } });
    await expect(importSetups(friend, broken)).rejects.toThrow(/Setup 2 in the file/);
    expect((await setupsFor(friend)).some((s) => s.name === "Fine")).toBe(false);
  });

  it("view links show one setup until turned off, and go with a deleted setup", async () => {
    const { hudson, friend } = await people();
    const id = await createSetup(friend, setupFromTemplate("Living room", "jbl7"));
    await expect(createSetupLink(hudson, id)).rejects.toBeInstanceOf(AccessDenied);
    await createSetupLink(friend, id);
    await createSetupLink(friend, id); // still one link
    const links = await setupLinks(friend, id);
    expect(links).toHaveLength(1);
    expect((await setupByLink(links[0].token))?.name).toBe("Living room");
    expect(await setupByLink("x".repeat(32))).toBeNull();

    await revokeSetupLink(friend, id, links[0].id);
    expect(await setupByLink(links[0].token)).toBeNull();

    await createSetupLink(friend, id);
    const [again] = await setupLinks(friend, id);
    await deleteSetup(friend, id);
    expect(await setupByLink(again.token)).toBeNull();
    await expect(getSetup(friend, id)).rejects.toBeInstanceOf(AccessDenied);
  });

  it("reads EQ screenshots only for people with app access, and says when it isn't set up", async () => {
    const { friend, other } = await people();
    const png = Buffer.from("89504e470d0a1a0a0000", "hex");
    await expect(readEqScreenshot(other, png)).rejects.toBeInstanceOf(AccessDenied);
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(readEqScreenshot(friend, png)).rejects.toThrow(/isn't set up/);
    } finally {
      if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
    }
  });
});
