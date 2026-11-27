import { describe, expect, it } from "vitest";
import { tripPreview } from "@/lib/mosey/preview";
import { giftCount } from "@/lib/gyfte/preview";

describe("share link previews", () => {
  it("a trip link says you're invited, with dates and place", () => {
    const p = tripPreview({ name: "Lake weekend", place: "Hillsdale", startDate: "2027-07-01", endDate: "2027-07-03", linkJoin: false }, "tok");
    expect(p.headline).toBe("You're invited: Lake weekend");
    expect(p.description).toBe("Jul 1 to 3, 2027 · Hillsdale · See the plan and ask to join");
    expect(p.image).toBe("/m/tok/og");
  });
  it("says tap to join when the trip lets people join from the link, and skips an empty place", () => {
    const p = tripPreview({ name: "X", place: "", startDate: "2027-12-17", endDate: "2027-12-23", linkJoin: true }, "t");
    expect(p.description).toBe("Dec 17 to 23, 2027 · Tap to join the trip");
  });
  it("counts gifts plainly", () => {
    expect([giftCount(0), giftCount(1), giftCount(5)]).toEqual(["No gifts yet", "1 gift", "5 gifts"]);
  });
});
