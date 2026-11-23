import { describe, expect, it } from "vitest";
import { safeFrom, withFrom } from "@/lib/back";

describe("back links follow only same-site paths", () => {
  it("keeps a path on this site", () => {
    expect(safeFrom("/mosey/abc")).toBe("/mosey/abc");
    expect(safeFrom(["/home", "/x"])).toBe("/home");
  });
  it("refuses other sites and odd values", () => {
    for (const bad of [undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", `/${"a".repeat(400)}`]) {
      expect(safeFrom(bad)).toBeNull();
    }
  });
  it("carries the way back along links inside People", () => {
    expect(withFrom("/admin/people/1", "/mosey/t?x=1")).toBe("/admin/people/1?from=%2Fmosey%2Ft%3Fx%3D1");
    expect(withFrom("/admin", null)).toBe("/admin");
  });
});
