import { describe, expect, it } from "vitest";
import { cleanFields, daysLeft, inlineParts, notesInStickiesFile, toggleMark } from "@/lib/jot/note";
import { InputError } from "@/lib/errors";

describe("Jot: cleaning a note", () => {
  it("keeps what a note may hold and defaults the rest", () => {
    expect(cleanFields({ body: "Milk\r\nEggs", colour: "pink", importance: "urgent", remindAt: "2027-01-02T15:00:00Z", remindBy: "email", sneaky: 1 })).toEqual({
      body: "Milk\nEggs",
      colour: "pink",
      importance: "urgent",
      remindAt: "2027-01-02T15:00:00.000Z",
      remindBy: "email",
    });
    expect(cleanFields({ body: 3, colour: "black", importance: "!!", remindAt: "" })).toEqual({
      body: "",
      colour: "yellow",
      importance: "none",
      remindAt: null,
      remindBy: "email",
    });
  });

  it("doesn't take texting from the page yet", () => {
    expect(cleanFields({ remindBy: "text" }).remindBy).toBe("email");
    expect(cleanFields({ remindBy: "none" }).remindBy).toBe("none");
  });

  it("refuses bad reminders and huge notes", () => {
    expect(() => cleanFields({ remindAt: "tomorrowish" })).toThrow(InputError);
    expect(() => cleanFields({ remindAt: "1850-01-01T00:00:00Z" })).toThrow(InputError);
    expect(() => cleanFields({ body: "x".repeat(20_001) })).toThrow(InputError);
    expect(() => cleanFields(null)).toThrow(InputError);
  });
});

describe("Jot: old Stickies files", () => {
  it("reads every shape the old app saved", () => {
    const file = JSON.stringify([
      { id: "a", text: "Old shape", colour: "blue", created: "2026-11-02T10:00:00Z" },
      { id: "b", text: "Gold tape", colour: "lilac", important: "gold", reminder: "2026-11-10T04:23:00Z", font: "hand", size: "large" },
      { id: "c", text: "True flag", important: true, remind_text: false, reminder: "2026-12-01T12:00:00Z" },
      { id: "d", text: "Red", important: "red" },
      { id: "e", text: "Later", important: "later", cell: { col: 1, row: 2 } },
      { id: "f", text: "Deleted", trashed_at: "2026-11-20T00:00:00Z", reminder: "nonsense" },
    ]);
    const notes = notesInStickiesFile(file);
    expect(notes.map((n) => n.importance)).toEqual(["none", "important", "important", "urgent", "later", "none"]);
    expect(notes[0]).toEqual({ body: "Old shape", colour: "blue", importance: "none", remindAt: null, remindBy: "email", createdAt: "2026-11-02T10:00:00.000Z", trashedAt: null });
    expect(notes[1].remindAt).toBe("2026-11-10T04:23:00.000Z");
    expect(notes[2].remindBy).toBe("none");
    expect(notes[3].colour).toBe("yellow");
    expect(notes[5]).toMatchObject({ trashedAt: "2026-11-20T00:00:00.000Z", remindAt: null });
  });

  it("refuses files that aren't Stickies notes", () => {
    expect(() => notesInStickiesFile("not json")).toThrow(/isn't JSON/);
    expect(() => notesInStickiesFile('{"notes": []}')).toThrow(/list of notes/);
    expect(() => notesInStickiesFile('[{"text": "ok"}, {"colour": "pink"}]')).toThrow(/Note 2/);
  });
});

describe("Jot: formatting", () => {
  it("finds bold, italic and links", () => {
    expect(inlineParts("Buy **milk** and *eggs* at https://shop.example/list.")).toEqual([
      { kind: "text", text: "Buy " },
      { kind: "bold", text: "milk" },
      { kind: "text", text: " and " },
      { kind: "italic", text: "eggs" },
      { kind: "text", text: " at " },
      { kind: "link", text: "https://shop.example/list", href: "https://shop.example/list" },
      { kind: "text", text: "." },
    ]);
    expect(inlineParts("2 * 3 * 4")).toEqual([{ kind: "text", text: "2 * 3 * 4" }]);
    expect(inlineParts("javascript:alert(1)")).toEqual([{ kind: "text", text: "javascript:alert(1)" }]);
  });

  it("toggles bold and italic around a selection", () => {
    const on = toggleMark("say hi now", 4, 6, "**");
    expect(on).toEqual({ text: "say **hi** now", start: 6, end: 8 });
    expect(toggleMark(on.text, on.start, on.end, "**")).toEqual({ text: "say hi now", start: 4, end: 6 });
    // Italic inside bold adds a mark instead of eating the bold.
    expect(toggleMark("say **hi** now", 6, 8, "*").text).toBe("say ***hi*** now");
  });

  it("counts Trash days down from 30", () => {
    const t = Date.parse("2026-11-01T12:00:00Z");
    expect(daysLeft(new Date(t).toISOString(), t + 1000)).toBe(30);
    expect(daysLeft(new Date(t).toISOString(), t - 5000)).toBe(30); // a browser clock a little behind
    expect(daysLeft(new Date(t).toISOString(), t + 29.5 * 86_400_000)).toBe(1);
  });
});
