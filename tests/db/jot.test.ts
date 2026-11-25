import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { admin, describeDb, makeUser } from "../support/db";
import { pool } from "@/lib/db";
import { AccessDenied, grantApp, revokeApp } from "@/lib/access";
import { appsFor } from "@/lib/apps";
import { InputError } from "@/lib/errors";
import {
  createNote,
  emptyTrash,
  getNote,
  importStickies,
  moveNote,
  notesFor,
  restoreNote,
  saveNote,
  trashCount,
  trashFor,
  trashNote,
} from "@/lib/jot/notes";

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/lib/email", () => ({
  sendEmail: async (m: { to: string; subject: string; text: string }) => {
    if (m.subject.includes("FAIL")) throw new Error("Resend down");
    sent.push(m);
  },
}));
const { sendDueReminders } = await import("@/lib/jot/reminders");

const note = (body: string, extra: Record<string, unknown> = {}) => ({ body, colour: "yellow", importance: "none", remindAt: null, ...extra });
const minutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

describeDb("Jot", () => {
  afterAll(async () => {
    await pool.end();
    await admin.end();
  });
  beforeEach(() => {
    sent.length = 0;
  });

  async function people() {
    const hudson = await makeUser({ isAdmin: true });
    const friend = await makeUser();
    const other = await makeUser();
    await grantApp(hudson, "jot", { userId: friend.id });
    return { hudson, friend, other };
  }

  it("needs app access, which an admin turns on per person", async () => {
    const { hudson, friend, other } = await people();
    expect((await appsFor(friend)).map((a) => a.id)).toContain("jot");
    expect((await appsFor(other)).map((a) => a.id)).not.toContain("jot");
    await expect(notesFor(other)).rejects.toBeInstanceOf(AccessDenied);
    await expect(createNote(other, note("Hi"))).rejects.toBeInstanceOf(AccessDenied);
    expect(await notesFor(hudson)).toEqual([]);
  });

  it("keeps each note private to its owner, admins included", async () => {
    const { hudson, friend } = await people();
    const id = await createNote(friend, note("Private"));
    expect((await notesFor(friend)).map((n) => n.body)).toEqual(["Private"]);
    expect(await notesFor(hudson)).toEqual([]);
    await expect(getNote(hudson, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(saveNote(hudson, id, note("Taken"))).rejects.toBeInstanceOf(AccessDenied);
    await expect(trashNote(hudson, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(restoreNote(hudson, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(moveNote(hudson, id, "up")).rejects.toBeInstanceOf(AccessDenied);
    await expect(getNote(friend, "not-a-uuid")).rejects.toBeInstanceOf(AccessDenied);
    // Emptying your own Trash never touches anyone else's.
    await trashNote(friend, id);
    await emptyTrash(hudson);
    expect(await trashCount(friend)).toBe(1);
  });

  it("stops working the moment app access is removed", async () => {
    const { hudson, friend } = await people();
    const id = await createNote(friend, note("Soon gone"));
    await revokeApp(hudson, "jot", { userId: friend.id });
    await expect(getNote(friend, id)).rejects.toBeInstanceOf(AccessDenied);
    await expect(saveNote(friend, id, note("x"))).rejects.toBeInstanceOf(AccessDenied);
  });

  it("puts new notes on top and moves them up and down", async () => {
    const { friend } = await people();
    const a = await createNote(friend, note("A"));
    await createNote(friend, note("B"));
    await createNote(friend, note("C"));
    expect((await notesFor(friend)).map((n) => n.body)).toEqual(["C", "B", "A"]);
    await moveNote(friend, a, "up");
    expect((await notesFor(friend)).map((n) => n.body)).toEqual(["C", "A", "B"]);
    await moveNote(friend, a, "up");
    await moveNote(friend, a, "up"); // already first: nothing happens
    expect((await notesFor(friend)).map((n) => n.body)).toEqual(["A", "C", "B"]);
  });

  it("Trash: keeps notes 30 days, restores to the top, and empties only on request", async () => {
    const { friend } = await people();
    const old = await createNote(friend, note("Old"));
    const recent = await createNote(friend, note("Recent"));
    await createNote(friend, note("Stays"));
    await trashNote(friend, old);
    await trashNote(friend, recent);
    await admin.query("update jot_notes set trashed_at = now() - interval '31 days' where id = $1", [old]);
    expect((await trashFor(friend)).map((n) => n.body)).toEqual(["Recent"]);
    await expect(getNote(friend, old)).rejects.toBeInstanceOf(AccessDenied);
    await expect(saveNote(friend, recent, note("Edit in trash"))).rejects.toBeInstanceOf(InputError);
    await restoreNote(friend, recent);
    expect((await notesFor(friend)).map((n) => n.body)).toEqual(["Recent", "Stays"]);
    await trashNote(friend, recent);
    expect(await emptyTrash(friend)).toBe(1);
    expect(await trashFor(friend)).toEqual([]);
  });

  it("imports an old Stickies file as new notes, all or nothing", async () => {
    const { friend } = await people();
    await createNote(friend, note("Already here"));
    const r = await importStickies(
      friend,
      JSON.stringify([
        { text: "First on the old board", colour: "pink", important: "red", created: "2026-11-02T10:00:00Z" },
        { text: "Second", reminder: "2026-11-10T04:23:00Z" },
        { text: "Deleted lately", trashed_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
        { text: "Deleted long ago", trashed_at: "2026-01-01T00:00:00Z" },
      ]),
    );
    expect(r).toEqual({ board: 2, trash: 1, skipped: 1 });
    const board = await notesFor(friend);
    expect(board.map((n) => n.body)).toEqual(["First on the old board", "Second", "Already here"]);
    expect(board[0]).toMatchObject({ colour: "pink", importance: "urgent", createdAt: "2026-11-02T10:00:00.000Z" });
    // A past reminder from the old app is kept on the note but never emailed.
    expect(board[1].remindedAt).not.toBeNull();
    expect((await trashFor(friend)).map((n) => n.body)).toEqual(["Deleted lately"]);
    await expect(importStickies(friend, '[{"text": "ok"}, {"nope": 1}]')).rejects.toBeInstanceOf(InputError);
    expect(await notesFor(friend)).toHaveLength(3);
  });

  it("emails a due reminder once, to the owner only", async () => {
    const { friend } = await people();
    const id = await createNote(friend, note("Call the florist\nabout peonies", { remindAt: minutes(60) }));
    await admin.query("update jot_notes set remind_at = now() - interval '1 minute' where id = $1", [id]);
    await createNote(friend, note("Not yet", { remindAt: minutes(60) }));
    await sendDueReminders();
    const mine = sent.filter((m) => m.to === `${friend.id}@example.test`);
    expect(mine).toHaveLength(1);
    expect(mine[0].subject).toBe("Reminder: Call the florist");
    expect(mine[0].text).toContain(`/jot/${id}`);
    sent.length = 0;
    await sendDueReminders();
    expect(sent.filter((m) => m.to === `${friend.id}@example.test`)).toHaveLength(0);

    // A new time means a new reminder.
    const fields = await getNote(friend, id);
    await saveNote(friend, id, { ...fields, remindAt: minutes(30) });
    await admin.query("update jot_notes set remind_at = now() - interval '1 minute' where id = $1", [id]);
    await sendDueReminders();
    expect(sent.filter((m) => m.to === `${friend.id}@example.test`)).toHaveLength(1);
    // Editing the text alone doesn't send it again.
    sent.length = 0;
    await saveNote(friend, id, { ...(await getNote(friend, id)), body: "Edited" });
    await sendDueReminders();
    expect(sent.filter((m) => m.to === `${friend.id}@example.test`)).toHaveLength(0);
  });

  it("sends nothing from the Trash, for show-only reminders, stale ones, or after access is removed", async () => {
    const { hudson, friend } = await people();
    const due = async (body: string, extra: Record<string, unknown> = {}, ago = "1 minute") => {
      const id = await createNote(friend, note(body, { remindAt: minutes(60), ...extra }));
      await admin.query(`update jot_notes set remind_at = now() - interval '${ago}' where id = $1`, [id]);
      return id;
    };
    await trashNote(friend, await due("Trashed"));
    await due("Show only", { remindBy: "none" });
    await due("Two days late", {}, "2 days");
    const r1 = await sendDueReminders();
    expect(sent.filter((m) => m.to === `${friend.id}@example.test`)).toHaveLength(0);
    expect(r1.skipped).toBeGreaterThanOrEqual(2);
    await due("After revoke");
    await revokeApp(hudson, "jot", { userId: friend.id });
    await sendDueReminders();
    expect(sent.filter((m) => m.to === `${friend.id}@example.test`)).toHaveLength(0);
  });

  it("tries again when the email fails", async () => {
    const { friend } = await people();
    const id = await createNote(friend, note("FAIL then fine", { remindAt: minutes(60) }));
    await admin.query("update jot_notes set remind_at = now() - interval '1 minute' where id = $1", [id]);
    const r = await sendDueReminders();
    expect(r.failed).toBeGreaterThanOrEqual(1);
    const { rows } = await admin.query("select reminded_at from jot_notes where id = $1", [id]);
    expect(rows[0].reminded_at).toBeNull();
    await admin.query("update jot_notes set body = 'fine now' where id = $1", [id]);
    await sendDueReminders();
    expect(sent.filter((m) => m.to === `${friend.id}@example.test`)).toHaveLength(1);
  });
});
