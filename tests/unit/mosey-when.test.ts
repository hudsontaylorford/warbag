import { describe, expect, it } from "vitest";
import { parseWhen, whenInput, whenLabel } from "@/lib/mosey/when";

describe("Mosey: when a stop happens", () => {
  it("takes times the way Crewmaxxing does", () => {
    expect(parseWhen("7pm")).toEqual({ ok: true, time: "19:00", part: null, assumed: false });
    expect(parseWhen("9:30a")).toMatchObject({ time: "09:30", assumed: false });
    expect(parseWhen("18:30")).toMatchObject({ time: "18:30", assumed: false });
    expect(parseWhen("noon")).toMatchObject({ time: "12:00" });
    // A bare hour is read the likely way and flagged, never silently.
    expect(parseWhen("7")).toEqual({ ok: true, time: "07:00", part: null, assumed: true });
  });

  it("takes parts of the day, TBD and any time", () => {
    expect(parseWhen("Morning")).toEqual({ ok: true, time: null, part: "morning", assumed: false });
    expect(parseWhen(" afternoon ")).toMatchObject({ part: "afternoon" });
    expect(parseWhen("tonight")).toMatchObject({ part: "evening" });
    expect(parseWhen("TBD")).toMatchObject({ time: null, part: "tbd" });
    expect(parseWhen("time TBD")).toMatchObject({ part: "tbd" });
    for (const any of ["", "  ", "any time", "Anytime", "all day"]) expect(parseWhen(any)).toEqual({ ok: true, time: null, part: null, assumed: false });
  });

  it("says plainly when it can't read something", () => {
    expect(parseWhen("soonish")).toEqual({ ok: false, error: expect.stringMatching(/isn't a time we recognize/) });
    expect(parseWhen("25:00").ok).toBe(false);
  });

  it("labels and refills the box the same way it reads", () => {
    expect(whenLabel({ time: "18:30", part: null })).toBe("6:30 PM");
    expect(whenLabel({ time: null, part: "morning" })).toBe("Morning");
    expect(whenLabel({ time: null, part: "tbd" })).toBe("Time TBD");
    expect(whenLabel({ time: null, part: null })).toBe("Any time");
    for (const w of [{ time: "07:05", part: null }, { time: null, part: "evening" as const }, { time: null, part: "tbd" as const }, { time: null, part: null }]) {
      const back = parseWhen(whenInput(w));
      expect(back.ok && { time: back.time, part: back.part }).toEqual(w);
    }
  });
});
