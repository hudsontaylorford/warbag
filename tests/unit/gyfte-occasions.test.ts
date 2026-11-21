import { describe, expect, it } from "vitest";
import { isPast, listTitle, nextBirthday, nextChristmas, parseDay } from "@/lib/gyfte/occasions";

describe("gyfte dates", () => {
  it("moves a list to History two weeks after its date", () => {
    expect(isPast("2026-12-25", "2027-01-08")).toBe(false);
    expect(isPast("2026-12-25", "2027-01-09")).toBe(true);
  });

  it("suggests the coming Christmas for a new list", () => {
    expect(nextChristmas("2026-11-21")).toBe("2026-12-25");
    expect(nextChristmas("2026-12-30")).toBe("2026-12-25");
    expect(nextChristmas("2027-01-05")).toBe("2027-12-25");
  });

  it("suggests the next birthday on the same day, handling Feb 29", () => {
    expect(nextBirthday("2025-03-14", "2026-11-21")).toBe("2027-03-14");
    expect(nextBirthday("2025-12-01", "2026-11-21")).toBe("2026-12-01");
    expect(nextBirthday("2024-02-29", "2026-11-21")).toBe("2027-02-28");
  });

  it("titles and validates", () => {
    expect(listTitle("Molly", "christmas", "2026-12-25")).toBe("Molly · Christmas 2026");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("2026-02-28")).toBe("2026-02-28");
  });
});
