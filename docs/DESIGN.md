# Design

**Direction: "Editorial OS"** (adopted 2026-11-21). Warm paper, navy ink, a display serif for titles, plain system sans for everything you read or tap. Bold on the launcher, calm inside apps. The illustrated logo is paused; one-letter monograms carry identity for now.

## Rules that hold regardless of the look

- Phone first: designed at 390px wide, then desktop. No horizontal scroll, nothing hover-only.
- Tap targets at least 44px (48px for primary buttons and list rows).
- Text-first and high contrast. Information over decoration.
- Links (accent color, never a fill) look different from buttons (solid ink, or outlined for quiet ones).
- Visible focus on everything interactive. Respect `prefers-reduced-motion`.
- One shared component for each pattern. Before making a new one, check whether an existing one fits.
- Every action shows it worked, after the server confirms.

## Tokens

All colors and fonts come from the `@theme` block in `src/app/globals.css`. Components use token names (`text-ink`, `bg-wash`, `border-line`, `text-accent`), never raw hex values.

| Token | Value | Use |
|---|---|---|
| page | #f6f0e4 | background (warm paper) |
| field | #fffcf5 | inputs, raised surfaces |
| wash | #ede4d3 | quiet panels |
| line | #d9cfbc | borders, dividers |
| ink | #14293a | text, primary buttons, the launcher field |
| soft | #5b6270 | secondary text, hints |
| accent | #00508f | links only |
| ember | #b4461a | app monograms, rare emphasis |
| cream | #ffcd82 | headline on navy, text selection |
| mist | #c9d3dc | secondary text on navy |

Contrast (WCAG): ink on page 13.1:1, soft on page 5.4:1 (4.9:1 on wash), accent on page 7.3:1, cream on ink 10.2:1, mist on ink 9.8:1, paper letter on ember 4.8:1. Every text pairing passes AA.

- **Type:** `title` (Instrument Serif, 36 to 52px, for page titles), `heading` (the serif at 30px, for section headings: short, a word or two) and `display` (the serif at any size: app names, monograms). Body and controls use the system sans. No serif below 20px.
- **Corners:** one radius, `--radius-control` (6px), on buttons, fields, panels and monograms.
- **Dark mode:** not designed yet. The launcher's navy field is a deliberate dark surface, not dark mode.

## Monograms

One serif letter in a square (`src/components/ui/Monogram.tsx`). Letters are assigned in `src/lib/apps.ts`, so no two apps share one.

| Letter | For | Tone |
|---|---|---|
| W | warbag (header, sign-in, favicon) | ink, cream letter |
| G | Gyfte | ember |

External apps (Chirk, Crewmaxxing) get no monogram: they aren't ours to brand, and the ↗ says they leave warbag.

## Per-app stance

- **Launcher and public home:** the bold surface. Navy field, cream serif headline, ember monograms. The launcher's heading is a plain greeting ("Hi, Hudson"): warbag is a personal app, not a product with a tagline. No decorative marks. On desktop the launcher is two columns (headline left, apps right) with the header widened to match.
- **Gyfte:** calm. Paper background, serif page titles, everything else plain sans. Lists are rows divided by hairlines, not cards. A list page leads with the person's name in the serif, the occasion as a small line above (`ListTitle`); screen readers hear the full title once. Family link pages carry a "G · Gyfte · warbag" eyebrow so people know where they've landed.
