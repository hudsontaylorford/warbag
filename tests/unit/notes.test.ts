import { describe, expect, it } from "vitest";
import { isLongNote, noteBlocks } from "@/lib/notes";

describe("noteBlocks", () => {
  it("keeps plain text as one paragraph with its line breaks", () => {
    expect(noteBlocks("Bring boots\nand snacks")).toEqual([{ kind: "text", lines: ["Bring boots", "and snacks"] }]);
  });

  it("splits paragraphs on blank lines", () => {
    expect(noteBlocks("One\n\n\nTwo")).toEqual([
      { kind: "text", lines: ["One"] },
      { kind: "text", lines: ["Two"] },
    ]);
  });

  it("turns -, * and • lines into one list, between paragraphs", () => {
    expect(noteBlocks("Check first:\n- snow\n* ice\n• footing\nThen decide.")).toEqual([
      { kind: "text", lines: ["Check first:"] },
      { kind: "list", items: ["snow", "ice", "footing"] },
      { kind: "text", lines: ["Then decide."] },
    ]);
  });

  it("leaves a dash inside a sentence alone, and handles Windows line ends", () => {
    expect(noteBlocks("Pickup 9-10am\r\n-no space here")).toEqual([{ kind: "text", lines: ["Pickup 9-10am", "-no space here"] }]);
  });

  it("returns nothing for blank notes", () => {
    expect(noteBlocks("  \n \n")).toEqual([]);
  });
});

describe("isLongNote", () => {
  it("folds long text or many lines, not short notes", () => {
    expect(isLongNote("Short note")).toBe(false);
    expect(isLongNote("x".repeat(221))).toBe(true);
    expect(isLongNote("a\nb\nc\nd\ne")).toBe(true);
    expect(isLongNote("a\nb\nc\nd")).toBe(false);
  });
});
