# Design

**Direction: "Editorial OS"** (adopted 2026-11-21). Warm paper, navy ink, a display serif for titles, plain system sans for everything you read or tap. Bold on the launcher, calm inside apps. The illustrated logo is paused; one-letter marks (a bare serif letter) carry identity for now.

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
| measured | #b4461a | chart line: what was recorded (Room Tuner) |
| target | #00508f | chart line: the target curve, dashed |
| predicted | #2e7d4f | chart line: predicted with the suggested EQ |

Contrast (WCAG): ink on page 13.1:1, soft on page 5.4:1 (4.9:1 on wash), accent on page 7.3:1, cream on ink 10.2:1, mist on ink 9.8:1, paper letter on ember 4.8:1. Every text pairing passes AA.

- **Type:** `title` (Instrument Serif, 36 to 52px, for page titles), `heading` (the serif at 30px, for section headings: short, a word or two) and `display` (the serif at any size: app names, monograms) and `masthead` (the serif at 56 to 120px, only for the launcher greeting). Body and controls use the system sans. No serif below 20px.
- **Corners:** one radius, `--radius-control` (6px), on buttons, fields and panels.
- **Dark mode:** not designed yet. The launcher's navy field is a deliberate dark surface, not dark mode.

## Monograms

One serif letter straight on the background, with no tile, square or frame (`src/components/ui/Monogram.tsx`; Hudson 2026-11-24, on every page). Letters are assigned in `src/lib/apps.ts`, so no two apps share one.

| Letter | For | Tone |
|---|---|---|
| W | warbag (header, sign-in, favicon) | ink on paper, cream on navy |
| G | Gyfte | ember |
| M | Mosey | ember |
| R | Room Tuner | ember |

External apps (Chirk, Crewmaxxing) get no monogram: they aren't ours to brand, and the ↗ says they leave warbag. The launcher shows no monograms at all (text only, Hudson 2026-11-24); letters still mark the header, sign-in, share pages and favicon.

## Per-app stance

- **Launcher and public home:** the bold surface ("Masthead", 2026-11-24). Navy field and a big cream serif greeting (`masthead` utility, 56 to 120px): a plain "Hi, Hudson", since warbag is a personal app, not a product with a tagline. The apps are **text only**: each name in the serif at 40px, no monogram and no description, split into "Apps" (warbag's own, ›) and "Other sites" (Chirk, Crewmaxxing, ↗ and a new tab). Small sans labels, no lines under the header or the labels; thin dividers only between rows. No decorative marks. On desktop the launcher is two columns (greeting left, apps right) with the header widened to match.
- **Gyfte:** calm. Paper background, serif page titles, everything else plain sans. Lists are rows divided by hairlines, not cards. A list page leads with the person's name in the serif, the occasion as a small line above (`ListTitle`); screen readers hear the full title once. Family link pages carry a "G · Gyfte · warbag" eyebrow so people know where they've landed.
- **Room Tuner:** calm, like Gyfte, and a long page on purpose: steps 1 to 4 top to bottom, then Rounds, Presets and Manage. Instructions are folded into bordered sections ("How the rounds work") so the steps stay short. Numbers use tabular figures. The chart uses the three chart tokens (each at least 3:1 on paper) plus soft for the previous round; the suggested values are drawn as sliders so they're easy to copy into a speaker's app.
