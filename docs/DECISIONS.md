# Decisions

Durable decisions, newest first. Each one says what was decided and why. When a decision changes, add a new entry and mark the old one superseded rather than editing history.

## 2026-11-20 · Sign-in and database setup (PR 1)

- **Invite only.** Better Auth email codes with sign-up turned off. An email without an account gets the same "code is on its way" reply and no email, so the sign-in page never reveals who has access. The owner account comes from `OWNER_EMAIL`; everyone else will be invited by an admin.
- **Codes:** 6 digits, 10 minutes, 5 attempts, stored hashed. Sessions last 60 days and refresh daily. Rate limits are stored in the database so they hold across serverless instances.
- **Migrations:** numbered SQL files in `db/migrations`, applied once each by `scripts/migrate.mjs` before every build (on Vercel, production deploys only, so an unmerged PR's preview can't change the production database). Never edit a shipped file; add a new one. Nothing to paste into Neon by hand.
- **Driver:** `pg` (node-postgres), which Better Auth uses directly. Chirk uses postgres.js; one driver here is simpler than two.

## 2026-11-20 · Ground rules (Hudson)

Reviewed the Drive docs "02 — Warbag Foundation and Build Rules · Proposed v1" and amended them. CLAUDE.md is the adopted version. Where 02 differs from the points below, these win.

1. **Database: Neon, not Supabase.** Created through Vercel Storage (no project sleeping, matches Chirk). Authorization is enforced in server code, not Row Level Security, so 02's RLS and pgTAP items become server-side checks plus automated access tests against a test database branch.
2. **Auth: Better Auth** with email + one-time code first (the sign-in Molly already knows from Chirk), Google optional later. Chosen over hand-rolling auth again because warbag has groups, grants and share links to protect.
3. **Reuse code freely.** Copying or adapting code from Chirk, CMX or other Hudson projects is encouraged. What's ruled out is rebuilding Chirk or CMX inside warbag; they stay separate products, linked from the launcher. Integrations (e.g. Chirk invites on a trip) only when Hudson asks.
4. **First app: Gyfte (gift lists)**, ahead of sticky notes, so the family can use it for Christmas 2026. Source: the "Ford Family Christmas Gifting" sheet (one tab per person, years stacked 2020-2025).
5. **Apartment watcher may scrape** Zillow, StreetEasy and classifieds for Hudson's personal, non-commercial use. Keep it polite: low frequency, no logins or paywalls bypassed, back off when blocked. Replaces 02's "only permitted sources" rule. Still a later project with its own worker.
6. **App names follow western / cowboy slang.** Interface labels stay plain (see LANGUAGE.md).
7. **Instinct** (instinct.com) assistant access: later. Rules in CLAUDE.md apply when it comes up.
8. **Framework: Next.js 16.** Chirk is on 15; we start new on the current version because 15's dependency tree had open security advisories. Chirk code ports with minor changes.
