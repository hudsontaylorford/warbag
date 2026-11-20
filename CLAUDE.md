# warbag

Hudson's personal website, app launcher and home for first-party tools at **warbag.rodeo**. Some things are public, some are shared with Molly, friends or groups, and most stay private.

This file is the rulebook. Durable decisions live in `docs/DECISIONS.md`; what's next is `ROADMAP.md`; where things stand is `STATUS.md`. Don't keep competing rulebooks anywhere else (Drive notes and chat do not override this repo).

## Who decides

- **Hudson decides scope** and explicitly authorizes implementation, permission changes and anything live (deploys, invites, emails, sharing, DNS).
- **Claude Code implements.** Inspect before editing; compare every request with this file and the code.
- A proposal, conversation, Google Doc or handoff note is never by itself permission to build, deploy, change access or release private data.

## What warbag is (and isn't)

- **One coherent experience:** a public homepage, a signed-in launcher, native apps that share one shell, login, components and permission system, and shareable pages (microsites, lists, itineraries).
- **Not a re-build of things that already work.** Chirk (chirk.fyi) and Crewmaxxing / CMX (crew-scheduler) stay their own products, domains, repos and logins. In warbag they are labeled external links. Integrations happen only when Hudson asks for them.
- **Reusing code is encouraged.** Copy or adapt good code and patterns from Chirk, CMX or anywhere else Hudson owns when it saves work. Reusing code is fine; duplicating a whole product is not.

## Stack

- Next.js (App Router) + TypeScript + Tailwind v4, hosted on Vercel.
- Postgres on **Neon**, created through Vercel Storage, env var `DATABASE_URL`. Only the server talks to the database.
- **Better Auth** for sign-in: email + one-time code first (same feel as Chirk), Google later if wanted. No shared passwords.
- Vercel Blob for files, Resend for email, Cloudflare for DNS.
- One repo. Native apps are modules inside it with a shared shell, UI and permissions layer.
- Background work: Vercel Cron for daily jobs. Anything more frequent (e.g. the apartment watcher) gets its own worker only when that feature is approved.

## Core principles

Clarity over cleverness. Correctness over speed. Privacy over convenience. One clear action over redundant steps. Short by default, explain on demand. Same meaning everywhere. Make the common thing easy and keep advanced options out of the way. No infrastructure or framework change just because it's fashionable.

## Access and privacy

- **Default private.** Deny unless explicitly granted.
- Model: **users**, **groups**, per-app access, per-item grants (view, contribute, manage), and **share links** (unguessable, revocable, optionally expiring, scoped to one item).
- **Authorization is enforced on the server** for every read, write, file, search, export and background job. Hidden buttons are never the security boundary. Protect against guessed URLs, cross-user leaks, revoked links and removed group members; removal takes effect on the next request.
- Each app's data is separate even in one database (its own tables and ownership checks).
- Never put private app names, health data or personal content in public HTML, the sitemap or indexed pages. Everything except the public homepage is `noindex`.
- Admin (invites, people, groups, grants, revoking links) is done in the app, not by editing database rows.
- Future assistant access (e.g. Instinct) gets its own revocable identity, starts read-only and is audited. It never inherits admin. Details later.

## Design and copy

- Phone first, excellent on desktop. Minimal, text-first, high contrast. The look isn't decided yet; it lives in tokens in `src/app/globals.css` so a direction is a contained change. See `docs/DESIGN.md`.
- One set of shared primitives (buttons, fields, menus, cards, dialogs, alerts, headers, nav). Don't create near-duplicate patterns.
- Links look different from buttons. Big tap targets, keyboard and focus support, readable contrast, respect reduced motion. Test on mobile Safari.
- Plain, accurate labels ("Save", "Share", "Archive"). Same words mean the same thing everywhere (`docs/LANGUAGE.md`). App names may be playful; interface wording is not.
- Never show success before the server confirms it. Errors say what happened and how to recover. Cover empty, loading, error and unavailable states. Preserve drafts; guard destructive actions without nagging.
- No em dashes in interface copy.

## How Claude works here

- Inspect before editing. Keep changes scoped: no surprise redesigns, replatforming, cross-app changes or permission expansions.
- Small, reversible commits and PRs. Auth and security changes get extra scrutiny and tests.
- Report what was actually run (lint, types, build, tests) and what wasn't. Never imply a test passed if it didn't run.
- Secrets live only in Vercel / local `.env` files, never in code, docs, Drive notes or logs. No real users, messages or purchases in automated tests.
- Separate dev and prod config; Neon branches for dev/test databases.
- Before calling something done: `npm run lint`, `npx tsc --noEmit`, `npm run build`, plus tests for any logic or access rule touched.
- Optional PR "Context / decisions" section: 1-3 bullets, under 100 words, only for things the diff doesn't explain.

## ChatGPT handoffs (only when Hudson asks)

Hudson sometimes uses ChatGPT for planning and review (read-only on GitHub). Exchanges go through the Drive folder "Warbag — AI Handoffs" and happen **only when Hudson asks**: no polling, status logs or acknowledgements. Claude writes only its own `Claude → ChatGPT` notes, one short doc per exchange, titled like `WRB-20261120-01 · Claude → ChatGPT · Topic · v1`; corrections are a new version. Never edit ChatGPT's notes or the protocol. No secrets or personal content in a note unless Hudson approves it.
