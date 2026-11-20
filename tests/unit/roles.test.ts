import { describe, expect, it } from "vitest";
import { atLeast, highest } from "@/lib/access/roles";

describe("access levels", () => {
  it("orders view < contribute < manage", () => {
    expect(atLeast("manage", "view")).toBe(true);
    expect(atLeast("contribute", "contribute")).toBe(true);
    expect(atLeast("view", "contribute")).toBe(false);
  });

  it("treats no access as below everything", () => {
    expect(atLeast(null, "view")).toBe(false);
  });

  it("picks the highest level", () => {
    expect(highest(["view", null, "manage", "contribute"])).toBe("manage");
    expect(highest([null, null])).toBeNull();
    expect(highest([])).toBeNull();
  });
});
