# Design

**The look is not decided yet.** Hudson is working on logo and direction. Until then the site uses a plain placeholder palette (borrowed from Chirk) so nothing is built around a look we'll throw away.

## Rules that hold regardless of the look

- Phone first: designed at 390px wide, then desktop. No horizontal scroll, nothing hover-only.
- Tap targets at least 44px (52px for primary buttons and list rows).
- Text-first and high contrast. Information over decoration.
- Links (accent color, never a fill) look different from buttons (solid ink).
- Visible focus on everything interactive. Respect `prefers-reduced-motion`.
- One shared component for each pattern. Before making a new one, check whether an existing one fits.
- Every action shows it worked, after the server confirms.

## Tokens

All colors and fonts come from the `@theme` block in `src/app/globals.css`. Components use token names (`text-ink`, `bg-wash`, `border-line`, `text-accent`), never raw hex values, so the eventual design lands as a change to that one block.

| Token | Placeholder | Use |
|---|---|---|
| ink | #1c1917 | text, primary buttons |
| soft | #78716c | secondary text, hints |
| line | #e7e5e4 | borders, dividers |
| wash | #f5f5f4 | quiet surfaces |
| page | #ffffff | background |
| accent | #3d5a99 | links only |

Dark mode: not designed yet.
