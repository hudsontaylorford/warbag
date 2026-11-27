import "server-only";
import { readFile } from "node:fs/promises";
import type { Metadata } from "next";
import { ImageResponse } from "next/og";

/**
 * Link previews for share links (Messages, WhatsApp, email), the way Chirk
 * does them: a bold line ("You're invited: Lake weekend"), a line of details,
 * and a 1200×630 card in the app's own look. Previews only ever show what the
 * link's page already shows to anyone with it, and they name the app, never
 * warbag. Share pages stay noindex.
 */

export type Preview = {
  /** The bold line in the preview, e.g. "You're invited: Lake weekend". */
  headline: string;
  /** The line under it: dates, place, what this is. */
  description: string;
  /** The card picture's address on this site, e.g. `/m/<token>/og`. */
  image: string;
};

export function previewMetadata(p: Preview & { title: string }): Metadata {
  return {
    title: p.title,
    description: p.description,
    robots: { index: false, follow: false },
    openGraph: { title: p.headline, description: p.description, images: [{ url: p.image, width: 1200, height: 630 }], type: "website" },
    twitter: { card: "summary_large_image", title: p.headline, description: p.description, images: [p.image] },
  };
}

let serif: Promise<Buffer> | null = null;
const loadSerif = () => (serif ??= readFile(new URL("../assets/instrument-serif-latin-400-normal.woff", import.meta.url)));

/** The card: a small line on top, the title big in the serif, details under it, the app's letter and name at the bottom. Paper and navy, like the app. */
export async function previewCard(c: { kicker: string; title: string; lines: string[]; app: string; letter: string }): Promise<ImageResponse> {
  const font = await loadSerif().catch(() => null);
  const size = c.title.length > 40 ? 76 : c.title.length > 24 ? 92 : 112;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f6f0e4", color: "#14293a", padding: 72 }}>
        <div style={{ fontSize: 34, color: "#5b6270", display: "flex" }}>{c.kicker}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: size, lineHeight: 1.02, fontFamily: font ? "Instrument Serif" : "serif", display: "flex" }}>{c.title}</div>
          {c.lines.map((l, i) => (
            <div key={i} style={{ fontSize: i === 0 ? 40 : 34, marginTop: i === 0 ? 28 : 10, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? "#14293a" : "#5b6270", display: "flex" }}>
              {l}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <div style={{ fontSize: 56, color: "#b4461a", fontFamily: font ? "Instrument Serif" : "serif", display: "flex" }}>{c.letter}</div>
          <div style={{ fontSize: 34, fontWeight: 600, display: "flex" }}>{c.app}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font ? [{ name: "Instrument Serif", data: font, style: "normal", weight: 400 }] : undefined,
    },
  );
}

/** A plain 404 for a link that's off: no card, nothing to learn. */
export const notFoundImage = () => new Response("Not found", { status: 404 });
