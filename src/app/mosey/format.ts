/** "Sat, Jun 5". Days are calendar dates, shown without time zones. */
export function dayLabel(day: string, opts: { year?: boolean } = {}): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(opts.year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** "Jun 5 to 8, 2027", or "Jun 30 to Jul 2, 2027". */
export function rangeLabel(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const md = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const year = e.getUTCFullYear();
  if (start === end) return `${md(s)}, ${year}`;
  const endPart = s.getUTCMonth() === e.getUTCMonth() ? String(e.getUTCDate()) : md(e);
  return `${md(s)} to ${endPart}, ${year}`;
}

export { timeLabel } from "@/lib/mosey/when";

/** Opens the place in Google Maps (search), no API key needed. */
export function mapsUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/** "6:30p", "12p", "9a": short enough for a calendar square on a phone. */
export function shortTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "a" : "p"}`;
}

/** The words for a stop's status. Same everywhere: the label, the form and docs/LANGUAGE.md. */
export const STATUS_LABEL = { tentative: "Tentative", asked: "Inquiry sent", confirmed: "Confirmed", booked: "Booked" } as const;
