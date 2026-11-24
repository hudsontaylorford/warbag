# Roadmap

Order of work. Each step is approved by Hudson before it starts.

1. **Foundation** (done: sign-in, access rules, launcher, people and access screens): Vercel project + Neon, Better Auth sign-in, users / groups / grants / share links, app registry (one list of every app: name, icon, URL, native or external, who can see it), public homepage, signed-in launcher, admin for invites and access, shared UI primitives.
2. **Gyfte** (gift lists): paused 2026-11-22, feature-complete for Christmas 2026; see STATUS.md for exactly where it stands. Done: lists and items, sharing and claims, bulk add, spreadsheet import into a group with who-is-who and kid splitting, family groups with a sample family and View as, kids under parents with joint lists, family link with "This is me", ask to join (Hudson approves), connecting name-only lists to people, My list / Family / I'm getting, the look. Next, in order: Hudson checks on Safari and runs the real import; go / no-go, then share the family link; turn off the family link once everyone has an account. Later: request-a-group for non-admins, photos (upload or image link), automatic link previews, list/grid view, drag to reorder, Chirk gift-exchange link, screenshot import.
3. **Mosey** (trip planner): **the priority** (Hudson, 2026-11-22). Private family trial on **December 1** with the Ford Christmas trip; see STATUS.md for exactly where it stands.
   - **Done (PRs 28 to 66):** trips, Plan and Ideas; money math, expenses and settle-up; receipts with AI drafts and paper-receipt rules; day cards and the trip calendar; typed "When"; Ideas layout; stop status; who's going (opt-in per stop); kids (adults-only splits); meals; competing options; reordering; co-organizers and people managers; settings that save themselves; one editor at a time; getting people in (invite by email, trip link with Join this trip, Ask to join from a trip's page, requests at the top of the trip); a way back from every page.
   - **Before December 1 (Hudson):** iPhone walkthrough, Christmas trip tidy-up, discard test receipt photos, go / no-go, then send the trip link.
   - **After the trial, candidates (each needs Hudson's go; order to be set from what the family hits):**
     - Place search (reuse Crewmaxxing's Google Places autocomplete, with typed text always allowed).
     - AI quick capture ("Dinner Friday at 7 near the rental") and "build a trip" from pasted notes, screenshots or sheets: Describe → Preview → Confirm, nothing saved until a person approves.
     - Hard commitments and deadlines on the plan (van return at noon), later reminders.
     - A shareable day or whole-trip schedule: printable view, copyable update, optional calendar (.ics) feed. Nothing sent automatically.
     - "What's changed" since you last looked.
     - Lodging by night (who sleeps where), only if real use needs it.
     - Meal duties and a short shopping list on a group meal (opt-in, never required).
     - An estimated cost on a stop, kept apart from real expenses (never double counted).
     - Suggestions from people without an account (reviewed by an organizer; never Money access).
     - Same-named groups told apart in pickers (member counts), and a deliberate cleanup of the duplicate "Ford Family" group.
     - Email the owner when someone asks to join (today: the notice on the trip).
4. **Room Tuner** (room EQ from phone recordings): moved into warbag 2026-11-23 (see STATUS.md). Its own next steps are in docs/ROOMTUNE.md; the first is an unprocessed iPhone recorder, which needs Hudson's go.
5. **Microsites and presentations:** hosted pages at stable URLs, private, group-shared or public link, listed in the launcher.
6. **Sticky notes:** rebuild of the lovewillwin version (handover pack pending).
7. **Songwriting:** rebuild, multi-user. Owned songs, collaborators, version history; no live co-editing until there's a real need.
8. **Fitness** and **nutrition:** replace Fitbod and calorie tracking. Private by default, exportable.
9. **Apartment watcher:** rebuild with a separate scheduled worker.

External links in the launcher from day one: **Chirk** (chirk.fyi) and **Crewmaxxing / CMX**.

**Launcher, next round:**
- Each person can show, hide and reorder their own apps.
- Personal bookmarks: anyone can add any site or URL to their launcher.
- The look is settled (see docs/DESIGN.md): the text-only "Masthead" launcher (2026-11-24) with "Apps" and "Other sites", bare letter marks in page headers, no slogans or decorative marks.

**Sign-in and accounts** (Hudson, 2026-11-23; each needs Hudson's go):
- **Signed-in devices** on Account: every active sign-in (browser or app, started, last used) with Sign out for each. Shows where sign-ins come from and ends ones you don't recognize.
- **Passkeys:** Face ID / Touch ID sign-in alongside email codes; no passwords (Better Auth passkey plugin).
- **Assistant access** (Instinct, agent browsers): today an agent can have its own non-admin account and be a trip's co-organizer (Hudson, 2026-11-23). Later: a dedicated assistant identity with revocable tokens and an audit trail, so it needn't sign in by email code on every run (an agent's browser starts from a fresh profile each run). For read-only review, a Mosey view link (`/m/…`) needs no sign-in.

Later: email on warbag.rodeo (hosted provider, not self-hosted), Chirk integration.
