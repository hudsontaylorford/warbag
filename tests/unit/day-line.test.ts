import { describe, expect, it } from "vitest";
import { dayLine } from "@/lib/mosey/day-line";
import type { Stop } from "@/lib/mosey/trips";

const stop = (s: Partial<Stop>): Stop => ({
  id: s.title ?? "x", day: "2026-12-18", suggestedDay: null, time: null, part: null, status: null, meal: null, askWho: false,
  choiceId: null, handledBy: "", title: "", place: "", link: "", notes: "", membersOnly: false, createdBy: null, mine: false, ...s,
});

describe("a day in one line", () => {
  it("keeps plan order, adds short times, and flags only what isn't settled", () => {
    const line = dayLine(
      [
        stop({ title: "Drive up", time: "13:00", status: "confirmed" }),
        stop({ title: "Groceries" }),
        stop({ title: "Pasta night", meal: "dinner", status: "tentative" }),
        stop({ title: "Pizza", status: "asked" }),
        stop({ title: "Van", status: "booked" }),
      ],
      {},
    );
    expect(line.map((i) => [i.title, i.time, i.flag])).toEqual([
      ["Drive up", "13:00", null],
      ["Groceries", null, null],
      ["Pasta night", null, "Tentative"],
      ["Pizza", null, "Inquiry sent"],
      ["Van", null, null],
    ]);
  });
  it("shows a set of options once, by its title, as Pick one", () => {
    const line = dayLine(
      [stop({ title: "Ski", choiceId: "c1", time: "09:00" }), stop({ title: "Brunch" }), stop({ title: "Spa", choiceId: "c1" })],
      { c1: { title: "Ski, spa or stay in" } },
    );
    expect(line.map((i) => [i.title, i.flag])).toEqual([
      ["Ski, spa or stay in", "Pick one"],
      ["Brunch", null],
    ]);
  });
  it("is empty for a day with nothing planned", () => {
    expect(dayLine([], {})).toEqual([]);
  });
});
