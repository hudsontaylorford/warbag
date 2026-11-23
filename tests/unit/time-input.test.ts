// Same cases as Crewmaxxing's tests for this parser, so the two stay in step.
import { describe, expect, it } from "vitest";
import { parseTime } from "@/lib/time-input";

const t = (s: string) => {
  const r = parseTime(s);
  return r.ok ? r.value : `error`;
};

describe("parseTime", () => {
  it("reads common shorthand", () => {
    expect(t("9am")).toBe("09:00");
    expect(t("9a")).toBe("09:00");
    expect(t("9:30p")).toBe("21:30");
    expect(t("9:30 PM")).toBe("21:30");
    expect(t("12pm")).toBe("12:00");
    expect(t("12am")).toBe("00:00");
    expect(t("noon")).toBe("12:00");
    expect(t("930")).toBe("09:30");
    expect(t("7.45a")).toBe("07:45");
  });

  it("reads 24-hour times as written", () => {
    expect(t("15:00")).toBe("15:00");
    expect(t("1530")).toBe("15:30");
    expect(t("09:00")).toBe("09:00");
    expect(t("0:30")).toBe("00:30");
    expect(parseTime("15:00")).toMatchObject({ assumed: false });
  });

  it("guesses AM/PM for bare hours but says it assumed", () => {
    expect(parseTime("9")).toEqual({ ok: true, value: "09:00", assumed: true });
    expect(parseTime("9:00")).toEqual({ ok: true, value: "09:00", assumed: true });
    expect(parseTime("3")).toEqual({ ok: true, value: "15:00", assumed: true });
    expect(parseTime("10:30")).toEqual({ ok: true, value: "10:30", assumed: true });
  });

  it("treats blank and TBD as no time", () => {
    expect(parseTime("")).toEqual({ ok: true, value: null, assumed: false });
    expect(parseTime("TBD")).toEqual({ ok: true, value: null, assumed: false });
  });

  it("rejects impossible input with a helpful message", () => {
    expect(parseTime("25:00").ok).toBe(false);
    expect(parseTime("9:75").ok).toBe(false);
    expect(parseTime("13pm").ok).toBe(false);
    expect(parseTime("soonish")).toMatchObject({ ok: false });
  });
});
