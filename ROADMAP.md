# Roadmap

Order of work. Each step is approved by Hudson before it starts.

1. **Foundation** (done: sign-in, access rules, launcher, people and access screens): Vercel project + Neon, Better Auth sign-in, users / groups / grants / share links, app registry (one list of every app: name, icon, URL, native or external, who can see it), public homepage, signed-in launcher, admin for invites and access, shared UI primitives.
2. **Gyfte** (gift lists): paused 2026-11-22, feature-complete for Christmas 2026; see STATUS.md for exactly where it stands. Done: lists and items, sharing and claims, bulk add, spreadsheet import into a group with who-is-who and kid splitting, family groups with a sample family and View as, kids under parents with joint lists, family link with "This is me", ask to join (Hudson approves), connecting name-only lists to people, My list / Family / I'm getting, the look. Next, in order: Hudson checks on Safari and runs the real import; go / no-go, then share the family link; turn off the family link once everyone has an account. Later: request-a-group for non-admins, photos (upload or image link), automatic link previews, list/grid view, drag to reorder, Chirk gift-exchange link, screenshot import.
3. **Mosey** (trip planner): **next priority** (Hudson, 2026-11-22). December 1 private trial with the family: PR 1 trips/Plan/Ideas (done), PR 2 money math (done), PR 3 expenses and settle-up, PR 4 receipts with AI drafts. Group trips, itineraries, reservations, costs; design from Hudson's real trip Sheets first. Reuse groundwork from Gyfte, Chirk and CMX where it saves work; Chirk and CMX stay separate products. Details to come from Hudson.
4. **Room tuner** (a custom Sonarworks-style room correction tool): already built elsewhere; migrate it into warbag as a native app. Where it lives now and its order relative to the apps below: to confirm with Hudson.
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

Later: email on warbag.rodeo (hosted provider, not self-hosted), Chirk integration, Instinct assistant access.
