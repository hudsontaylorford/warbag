/**
 * Natural time entry: "9a", "9:30p", "15:00", "noon", "930".
 * Copied from Crewmaxxing (crew-scheduler, src/lib/domain/time-input.ts) so
 * times are typed the same way in both; keep the two in step.
 *
 * Results are 24-hour "HH:MM" strings. When AM/PM wasn't stated we pick the
 * likely reading (7-11 → AM, 12-6 → PM) and say so via `assumed`, so the UI
 * can show "Read as 3:00 PM" instead of guessing silently.
 */

export type ParsedTime =
  | { ok: true; value: string | null; assumed: boolean }
  | { ok: false; error: string };

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

type Piece = { h: number; m: number; suffix: "am" | "pm" | null; twentyFour: boolean };

function parsePiece(raw: string): Piece | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "").replace(/\./g, ":");
  if (s === "noon") return { h: 12, m: 0, suffix: "pm", twentyFour: false };
  if (s === "midnight") return { h: 0, m: 0, suffix: null, twentyFour: true };
  const match = /^(\d{1,4})(?::(\d{2}))?(a|am|p|pm)?$/.exec(s);
  if (!match) return null;
  let digits = match[1];
  let minutes = match[2];
  if (!minutes && digits.length >= 3) {
    // "930" -> 9:30, "1530" -> 15:30
    minutes = digits.slice(-2);
    digits = digits.slice(0, -2);
  }
  const h = Number(digits);
  const m = minutes ? Number(minutes) : 0;
  const suffix = match[3] ? (match[3].startsWith("a") ? "am" : "pm") : null;
  if (m > 59) return null;
  if (suffix) {
    if (h < 1 || h > 12) return null;
    return { h, m, suffix, twentyFour: false };
  }
  if (h > 23) return null;
  // "0:30", "09:00", "15:00" read as 24-hour clock.
  const twentyFour = h === 0 || h >= 13 || digits.length === 2 && digits.startsWith("0");
  return { h, m, suffix: null, twentyFour };
}

function to24(p: Piece, guess: "am" | "pm"): number {
  if (p.twentyFour) return p.h;
  const suffix = p.suffix ?? guess;
  if (suffix === "am") return p.h === 12 ? 0 : p.h;
  return p.h === 12 ? 12 : p.h + 12;
}

/** Likely half of the day for a bare hour in event work: 7–11 morning, 12–6 afternoon. */
function likelySuffix(h: number): "am" | "pm" {
  return h >= 7 && h <= 11 ? "am" : "pm";
}

export function parseTime(input: string): ParsedTime {
  const s = input.trim();
  if (s === "" || /^tbd$/i.test(s)) return { ok: true, value: null, assumed: false };
  const p = parsePiece(s);
  if (!p) return { ok: false, error: `"${s}" isn't a time we recognize. Try 9am, 2:30pm or 14:30.` };
  const assumed = !p.twentyFour && p.suffix === null;
  return { ok: true, value: hhmm(to24(p, likelySuffix(p.h)), p.m), assumed };
}
