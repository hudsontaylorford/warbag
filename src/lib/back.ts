import "server-only";
import type { Actor } from "./access";
import { getTrip } from "./mosey/trips";

/**
 * "‹ Back to …" for pages you visit on the way (People, Account): where you
 * came from, passed as ?from=. Only same-site paths are followed, and a
 * trip's name shows only to someone who can open that trip.
 */

export type Back = { href: string; label: string };

/** A same-site path, or null. Never another site (//host) or a scheme. */
export function safeFrom(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.length > 300) return null;
  return value;
}

const PLACES: [RegExp, string][] = [
  [/^\/home(\?|$)/, "warbag home"],
  [/^\/mosey\/?(\?|$)/, "Trips"],
  [/^\/mosey\/new/, "Mosey"],
  [/^\/roomtune/, "Room Tuner"],
  [/^\/gyfte\/groups\//, "Family"],
  [/^\/gyfte/, "Gyfte"],
  [/^\/account/, "Account"],
];

const TRIP = /^\/mosey\/([0-9a-f-]{36})(\/[a-z/]*)?(\?.*)?$/i;

/** Where "‹ Back" goes, with a plain label; null when there's nowhere to go back to. */
export async function backFrom(actor: Actor, raw: string | string[] | undefined): Promise<Back | null> {
  const href = safeFrom(raw);
  if (!href || href.startsWith("/admin")) return null;
  const trip = TRIP.exec(href);
  if (trip) {
    const name = await getTrip(actor, trip[1]).then((t) => t.name).catch(() => null);
    return { href, label: name ?? "the trip" };
  }
  const place = PLACES.find(([re]) => re.test(href));
  return place ? { href, label: place[1] } : null;
}

/** Keeps ?from= on links that stay inside People, so the way back survives a few clicks. */
export function withFrom(href: string, from: string | null): string {
  return from ? `${href}${href.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}` : href;
}
