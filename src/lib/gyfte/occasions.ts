// Occasions and dates for Gyfte lists. Pure functions; dates are plain
// calendar days ("2026-12-25"), never times.

export const OCCASIONS = ["christmas", "birthday"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const CLAIM_MODES = ["anonymous", "named", "off"] as const;
export type ClaimMode = (typeof CLAIM_MODES)[number];

/** A list moves to History this many days after its date. */
export const HISTORY_AFTER_DAYS = 14;

export function isOccasion(v: unknown): v is Occasion {
  return typeof v === "string" && (OCCASIONS as readonly string[]).includes(v);
}

export function isClaimMode(v: unknown): v is ClaimMode {
  return typeof v === "string" && (CLAIM_MODES as readonly string[]).includes(v);
}

/** "2026-11-21" for a Date, in UTC. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

/** Is the list's occasion far enough behind us to count as History? */
export function isPast(occasionDate: string, today: string): boolean {
  return addDays(occasionDate, HISTORY_AFTER_DAYS) < today;
}

/** The next Christmas that isn't already in History. */
export function nextChristmas(today: string): string {
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-12-25`;
  return isPast(thisYear, today) ? `${year + 1}-12-25` : thisYear;
}

/**
 * The next birthday on the same month and day as a past one, e.g. the
 * person's last birthday list. Feb 29 falls back to Feb 28 in other years.
 */
export function nextBirthday(previous: string, today: string): string {
  const [, mm, dd] = previous.split("-");
  let year = Number(today.slice(0, 4));
  for (;;) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const day = mm === "02" && dd === "29" && !leap ? "28" : dd;
    const candidate = `${year}-${mm}-${day}`;
    if (!isPast(candidate, today)) return candidate;
    year += 1;
  }
}

/** "Christmas 2026" or "Birthday 2027". */
export function occasionLabel(occasion: Occasion, date: string): string {
  return `${occasion === "christmas" ? "Christmas" : "Birthday"} ${date.slice(0, 4)}`;
}

/** "Molly · Christmas 2026". */
export function listTitle(recipientName: string, occasion: Occasion, date: string): string {
  return `${recipientName} · ${occasionLabel(occasion, date)}`;
}

/** A valid calendar day "YYYY-MM-DD", or null. */
export function parseDay(raw: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || isoDay(d) !== raw ? null : raw;
}
