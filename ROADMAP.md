# Roadmap

Order of work. Each step is approved by Hudson before it starts.

1. **Foundation** (done: sign-in, access rules, launcher, people and access screens): Vercel project + Neon, Better Auth sign-in, users / groups / grants / share links, app registry (one list of every app: name, icon, URL, native or external, who can see it), public homepage, signed-in launcher, admin for invites and access, shared UI primitives.
2. **Gyfte** (gift lists): paused 2026-11-22, feature-complete for Christmas 2026; see STATUS.md for exactly where it stands. Done: lists and items, sharing and claims, bulk add, spreadsheet import into a group with who-is-who and kid splitting, family groups with a sample family and View as, kids under parents with joint lists, family link with "This is me", ask to join (Hudson approves), connecting name-only lists to people, My list / Family / I'm getting, the look. Next, in order: Hudson checks on Safari and runs the real import; go / no-go, then share the family link; turn off the family link once everyone has an account. Later: request-a-group for non-admins, photos (upload or image link), automatic link previews, list/grid view, drag to reorder, Chirk gift-exchange link, screenshot import.
3. **Mosey** (trip planner): **next priority** (Hudson, 2026-11-22). December 1 private trial with the family: PR 1 trips/Plan/Ideas (done), PR 2 money math (done), PR 3 expenses and settle-up (done), PR 4 receipts with AI drafts (done); then from the Christmas-trip test: paper receipts, day cards and the trip calendar, time entry, Ideas layout, stop status, kids, meals, ask who's going, competing options, reordering (all done, PRs 33 to 50). Group trips, itineraries, reservations, costs; design from Hudson's real trip Sheets first. Reuse groundwork from Gyfte, Chirk and CMX where it saves work; Chirk and CMX stay separate products. Details to come from Hudson.
4. **Room tuner** (a custom Sonarworks-style room correction tool): **in progress** (resumed by Hudson, 2026-11-23). A native app at `/roomtune`, with its screens rebuilt in warbag's look.
5. **Microsites and presentations:** hosted pages at stable URLs, private, group-shared or public link, listed in the launcher.
6. **Sticky notes:** rebuild of the lovewillwin version (handover pack pending).
7. **Songwriting:** rebuild, multi-user. Owned songs, collaborators, version history; no live co-editing until there's a real need.
8. **Fitness** and **nutrition:** replace Fitbod and calorie tracking. Private by default, exportable.
9. **Apartment watcher:** rebuild with a separate scheduled worker.

External links in the launcher from day one: **Chirk** (chirk.fyi) and **Crewmaxxing / CMX**.

**Launcher, next round:**
- Each person can show, hide and reorder their own apps.
- Personal bookmarks: anyone can add any site or URL to their launcher.
- The look is settled (see docs/DESIGN.md): plain and personal, no slogans or decorative marks.

**Sign-in and accounts** (Hudson, 2026-11-23; each needs Hudson's go):
- **Signed-in devices** on Account: every active sign-in (browser or app, started, last used) with Sign out for each. Shows where sign-ins come from and ends ones you don't recognize.
- **Passkeys:** Face ID / Touch ID sign-in alongside email codes; no passwords (Better Auth passkey plugin).
- **Assistant access** (Instinct, agent browsers): today an agent can have its own non-admin account and be a trip's co-organizer (Hudson, 2026-11-23). Later: a dedicated assistant identity with revocable tokens and an audit trail, so it needn't sign in by email code on every run (an agent's browser starts from a fresh profile each run). For read-only review, a Mosey view link (`/m/…`) needs no sign-in.

Later: email on warbag.rodeo (hosted provider, not self-hosted), Chirk integration.
