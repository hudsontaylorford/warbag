# Decisions

Durable decisions, newest first. Each one says what was decided and why. When a decision changes, add a new entry and mark the old one superseded rather than editing history.

## 2026-11-21 · People and access screens (PR 5)

- **Admin screens at `/admin`** (header link "People", admins only; everyone else gets "not found"): invite by email, a page per person (name, apps, groups, remove) and per group (members, apps, name, delete).
- **Inviting** adds the person and, unless unticked, emails them how to sign in. They see no apps until given some, directly or through a group.
- **Checkbox lists save exactly what's ticked**, recorded in the activity log as individual grants and removals.
- **Removing someone** deletes their sign-ins, memberships, grants and share links. Admins can't remove themselves. (Apps will decide what happens to a removed person's own items, e.g. Gyfte lists, when they're built.)
- **Destructive actions take two taps** ("Remove", then "Yes, remove") with the consequence spelled out; no pop-up dialogs.
- External apps in the launcher show only ↗ (Hudson: no need to show the address).

## 2026-11-20 · Gyfte decisions (Hudson)

1. **Lists for people without an account** (kids): a parent owns and manages the list. A list's owner and the person it's for can differ.
2. **Claims are a per-list setting:** Off, Named (others see who claimed) or Anonymous (others see that it's claimed, not by whom). In every mode the person the list is for never sees claims.
3. **Occasions:** Christmas and birthdays.
4. **History:** import every year from the 2020-2025 sheet, cleaned up (tracking junk stripped from links, "Link 1 / Link 2" and "or" rows merged into one item, old X and strikethrough marks handled). Everyone can delete their own old entries.

## 2026-11-20 · Launcher (PR 3)

- **One app registry** (`src/lib/apps.ts`): id, name, short description, native or external, link, live or coming soon. The launcher shows the apps `canUseApp` allows: admins see all, others only what's been shared with them.
- **External apps** (Chirk, Crewmaxxing) open in a new tab and show where they go (e.g. "chirk.fyi ↗"). Warbag shares no login or data with them.
- **Shared header** (`AppHeader`) on every signed-in page: warbag (back to the launcher), the app name, Sign out.
- The public homepage stays a placeholder (and `noindex`) until Hudson decides what it shows.

## 2026-11-20 · Access model (PR 2)

Rules in `src/lib/access`, tests in `tests/db/access.test.ts`.

- **Admins run the place, not the content.** Admins manage people, groups and app access, but being admin does not open anyone's items. Gift lists, notes and songs stay private to their owner and whoever they share with. (This is what keeps Gyfte surprises safe even from the admin.)
- **Levels:** view < contribute < manage. The owner always has manage. Managers can share onward; only managers see or change who has access.
- **Groups** are created and filled by admins. People see only the groups they're in and can share only with those, so group names and members stay private.
- **App access** decides who sees an app in the launcher and can make their own items. Item grants and links work regardless, so you can share one list with someone who doesn't use the app.
- **Share links** open one item, never grant manage, can expire, are revoked instantly, and die with the account that made them. Tokens are 192-bit random and stored as-is so "Copy link" keeps working; hashing them would only protect against someone who can already read the items themselves.
- **Refusals look like "not found"**, so guessed URLs can't confirm something exists.
- **Nothing is cached:** every request re-checks, so removals apply on the next page load.
- **Activity log:** every access change is recorded in `audit_events` (who, what, when).

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
