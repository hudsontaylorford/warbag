import "server-only";
import type { Preview } from "../preview";
import { rangeLabel } from "@/app/mosey/format";

/** What a trip link's preview says: "You're invited: Lake weekend", then dates and place. */
export function tripPreview(trip: { name: string; place: string; startDate: string; endDate: string; linkJoin: boolean }, token: string): Preview & { lines: string[] } {
  const lines = [rangeLabel(trip.startDate, trip.endDate), trip.place].filter(Boolean);
  return {
    headline: `You're invited: ${trip.name}`,
    description: [...lines, trip.linkJoin ? "Tap to join the trip" : "See the plan and ask to join"].join(" · "),
    image: `/m/${token}/og`,
    lines,
  };
}
