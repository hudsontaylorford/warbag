# Status

**2026-11-24.** Mosey's build is done and waits on Hudson's own checks before a private family trial on **December 1**. Gyfte is paused and ready for Christmas. Room Tuner is live at /roomtune. Jot (sticky notes, the old Stickies) is live at /jot since 2026-11-25 (PR 76). Everything below is live at https://warbag.rodeo (last change: PR 67, the text-only launcher and bare letters). Screenshots of every Mosey page, phone and desktop, made-up data: Drive "Warbag — AI Handoffs" › "Mosey · All pages · current (after PR 55, 2026-11-23)"; latest Claude note: WRB-20261124-01 (this status and the full roadmap); latest Instinct note: WRB-20261123-02 (newcomer field test and rerun). What's next and later: ROADMAP.md; why: docs/DECISIONS.md.

## warbag (the hub)

### Live
- **Launcher, "Masthead"** (PR 67, 2026-11-24): navy field, a big cream "Hi, Hudson", then app names only (no letters, no descriptions) under **Apps** (warbag's own, ›) and **Other sites** (Chirk, Crewmaxxing, ↗). No lines under the header or labels; no setting for another style. Two columns on desktop.
- **Letters:** every page's header shows its place's letter as a bare ember serif letter with no square (G Gyfte, M Mosey, R Room Tuner, J Jot, P People, A Account); W is warbag itself. Only the favicon keeps a square.
- **App first** (2026-11-27): only admins, people managers and people with two or more apps see warbag (the header link, the launcher). Everyone else sees just their app: signing in lands there, tabs, share pages, the sign-in page and emails name the app, and each app has its own favicon letter.
- **More than one admin** (2026-11-27): People → a person → Admin → "Make admin" (after a confirm). Never yourself, never a guest or sample person, always at least one admin, logged.
- **Link previews** (2026-11-27): trip links, guest links, gift list and family links and Room Tuner view links preview like Chirk's ("You're invited: Lake weekend", dates and place, a card in the app's look).
- Sign-in (email code, invite only), people, groups, app access, people managers, a way back from every page. Details under "Accounts and access" below.

### Next (each needs Hudson's go)
1. **Polish pass** (2026-11-24): the top fixes shipped (bigger back links, text buttons in ink, one action per day card, cream focus on the launcher, note formatting with bullets and "Show all"; on day cards notes show one line). Then a one-row calendar for trips of a week or less. Left from the critique: a Manage link beside Plan / Ideas / Money.
2. **Contrast and tap-target check** on the pages the family will use, before December 1.
3. **Launcher, next round:** show, hide and reorder your own apps; personal bookmarks.
4. **Sign-in and accounts:** signed-in devices, passkeys, a dedicated assistant identity (see ROADMAP.md).
5. Kept for later, not approved: "press and arrive" motion from a launcher row into the app's header (off for reduced motion).

## Mosey (trip planner)

### Live
- **Plan:** the trip one line per day on top (what's planned, flags for Tentative, Inquiry sent and Pick one, the day's area; tap a row to jump to it), then one card per day (with Morning / Afternoon / Evening / Any time headings when a day spans more than one, and an optional members-only "Staying" line shown when it changes) with an optional area and tag, Today, and days already over collapsed. One "+ Add to this day" per day. Organizers can **Reorder** a day (times set the order; untimed stops go anywhere).
- **Stops:** typed "When" the Crewmaxxing way (7pm, 9:30a, Morning, TBD); status (Tentative, Inquiry sent, Confirmed, Booked); meals (Breakfast, Lunch, Dinner, Food & drink) with "Who's handling it"; members-only details hidden on view links.
- **Who's going:** only on stops that ask ("Ask who's going"), from the trip's people list; one tap "I'm going" / "Maybe".
- **Options:** "Monday afternoon: ski, hike or spa" as one block; each person picks one; "Who picked what".
- **Ideas:** Food & drink filter; "Move to a day" opens the days as buttons; pasting a link files it as the link.
- **Money:** expenses, payments already made, people and households, settle-up (Direct or through one person), frozen versions, change log. **Kids** are on the trip but left out of splits unless ticked in (their share goes to their household); they never pay.
- **Receipts:** photo → AI draft → a person checks and saves. Paper rules (handwritten tips, card slips), asks when unsure (tip tables, added tips, lines that don't add up), never guesses a date, warns about IDs or cards in the photo, unsaved photos can be discarded. Checked on 8 of Hudson's real receipts: 7/8 (the miss: a handwritten 4 read as a 9; the form asks and "Something else" covers it).
- **Getting people in:** **Invite by email** from Manage (on warbag and the trip in one step, as Member or Co-organizer, with an email naming the trip). The **trip link** (anyone sees the plan and ideas, never money or names) has **Join this trip**: name and email, now or later; the owner taps Add under Manage → Asking to join. Someone signed in who opens a trip's own address without being on it gets **Ask to join** right there (same answer whether or not the trip exists). Signed out, the sign-in page says the trip is private and points at the trip link; sign-in says plainly that warbag is invite only. The trip link sits at the top of Manage with **Share link** (phone share sheet) and Copy. When someone asks to join, the trip shows "1 asking to join · Review" at the top and Manage opens with the request first.
- **Sharing:** members, **co-organizers** (everything except sharing or deleting the trip), the trip link.
- **Join from the trip link** (2026-11-27, off by default per trip): Manage → Trip link → "Join and edit, no sign-in". People pick their name and are members without an account; each gets their own link; Money is a separate switch; receipt photos need a sign-in. The owner sees **Joined by link** with Turn off, and can make a **New link**. Saving by email is next.
- **Editing:** one editor open at a time, named ("Editing: Van pickup"); unsaved changes are kept until Save or Cancel; Save closes it with "Saved ✓". Settings (Manage, People, Account) save themselves.
- **Test trips:** Maine and North Shore entered and compared with the sheets: they match, except the Maine cabins, which the sheet marks as paid directly.

### Left before December 1 (Hudson)
1. **iPhone walkthrough in Safari** (automated tests emulate an iPhone in Chromium).
2. **Christmas trip tidy-up:** on Money → People and households, tick **Kid** for the three kids and check their households (assignments were provisional; one name may be Lenox or Lennox). Link your own account to your name to get the one-tap "I'm going" and "Pick this".
3. **Discard the test receipt photos** on the live trip (Money → "photos not saved as expenses").
4. **Go / no-go** before inviting anyone, then send the family the **trip link** (Manage → Trip link) and add people as they ask. Nothing goes to family until Hudson says so.
5. **Have Instinct repeat the newcomer flow on a real phone:** open the trip link, ask to join, then you tap "Review" at the top of the trip and Add. Not yet checked anywhere: a real iPhone, the "No code?" wording after Send code, the "you've been added" email arriving.

### Field tests so far
- **Instinct newcomer test, 2026-11-23** (WRB-20261123-02): a dead end on the trip's app address, fixed in PR 65; the rerun verified Ask to join, the trip link signed out, member controls (no organizer tools), edits that persist, Who's going and Delete. Its two follow-ups (requests hard to find, no way back from People) were fixed in PR 66, which hasn't been tried by a person yet.
- **Hudson's Christmas trip entry, 2026-11-22** (WRB-20261122-02): drove PRs 33 to 50.

### Open questions (from the Christmas trip notes)
- Duplicate "Ford Family" groups (one empty) look the same in pickers; clean up deliberately.
- Christmas dates: settled, Dec 17 to 24 (Hudson, 2026-11-27).

### Known gaps
- Inviting new people from a trip needs an admin or people manager (by design; today Hudson and his agent).
- Nobody is emailed when someone asks to join a trip; the owner sees "N asking to join" at the top of the trip.
- Asking to join from a trip's page tells whoever floods it with requests that the trip exists ("try again in an hour"); the address is a random id nobody can guess, so this is accepted.
- Gyfte's sharing still has its own Share / Save step (Gyfte is paused).

## Room Tuner (room EQ)

### Live
- **Native app at /roomtune** (PR 57; docs PRs 58 and 59), for Hudson and anyone he ticks it for under People → Apps. One setup per speaker and room; each is private to its owner.
- **The same tool as the old page, in warbag's look:** play pink noise, record rounds at 3 spots, upload, see the room against the target, copy the suggested slider values, save presets, measure band width. Recordings are analyzed in the browser (Lossless included); only 55 numbers per recording are saved.
- **Saved to your account** after each change, confirmed by the server. **Import setups** reads the old page's export file. **View link** per setup for anyone without an account.
- **Fill from a screenshot** on a new setup reads the speaker app's EQ screen, using Mosey's Anthropic key.

### Left (Hudson)
1. **Import your setup:** Room Tuner → Import setups → `room-tuner-setups.json`.
2. **Try it on your phone in Safari**, including a Voice Memos upload and Fill from a screenshot (automated tests use Chromium; screenshot reading has no automated test because it calls Claude).
3. **Turn off the old page's public link** (claude.ai artifact "Room Tuner": set it to private), once you're happy here.

### Next (needs Hudson's go)
- Its own roadmap is in docs/ROOMTUNE.md; first up is an unprocessed iPhone recorder.

## Jot (sticky notes)

### Live
- **Native app at /jot** (PR 76, 2026-11-25): the old Stickies, renamed. Notes with colours and labels (Important, Urgent, Later), your own order or By label, a 30-day Trash, Import from Stickies. For Hudson and anyone he ticks it for under People → Apps; notes are private to their owner.
- **Reminders by email** from a GitHub Actions schedule every 5 minutes (`CRON_SECRET` in Vercel and GitHub; first good run 2026-11-25, PR 78). Texting kept for later.

### Left (Hudson)
1. **Try it on your phone in Safari**, including a reminder a few minutes ahead (Hudson, 2026-11-25: later). There are no old Stickies notes to import.

### Next (needs Hudson's go)
- Its own roadmap is in docs/JOT.md; first up is texting reminders.

## Accounts and access
- **A way back:** People and Account remember the page you came from ("‹ Back to Ford Christmas"), including through a person's or group's page. Room Tuner's setup, layout and new-setup pages have "‹ Setups" links.

- **Assistant (agent) access**, Hudson's decision 2026-11-23: its own non-admin account. It can be a trip's **co-organizer** and a **people manager** (invite people, manage groups and app access; never its own access or an admin's, no removing people or deleting groups). It never gets admin.
- Setting it up (🟢 PRODUCTION, warbag.rodeo): People → Invite someone (the agent's email) → open it → tick **People manager**; give it **Mosey** under Apps if it should start trips; on each trip, Manage → **Co-organizers** → tick it.
- An agent's browser starts fresh each run, so it signs in with an email code every time. For read-only review, a trip's view link needs no sign-in.
- **Roadmap (each needs Hudson's go):** signed-in devices on Account, passkeys, a dedicated assistant identity with revocable tokens and an audit trail.

## Gyfte

**2026-11-22. Gyfte is paused, feature-complete for Christmas 2026 and not yet opened to the family.** Everything below is live at https://warbag.rodeo (last change: PR 24). Screenshots of every page, phone and desktop, made-up data: Drive "Warbag — AI Handoffs" › "Warbag · All pages · current (after PR 24, 2026-11-21)".

### What's live

- **warbag:** invite-only email-code sign-in, access rules (users, groups, per-item grants, share links, audit log), People admin, the launcher (now the text-only Masthead, see "warbag (the hub)" above), a public page with only the name and Sign in.
- **Look:** paper and navy palette, serif titles, bare W and G letters (no squares since 2026-11-24), no slogans or decorative marks (personal app). See docs/DESIGN.md.
- **Gyfte, everyday:** three tabs: My list (yours and your kids'), Family (opens your family group), I'm getting (your claims). Lists for Christmas and birthdays; one add box, bulk add, star, Got it, History (read-only after the date plus 14 days, "Edit history" to change), copy to this year (owner or a co-parent).
- **Gyfte, family:** family groups (year › people › lists, kids nested under parents, joint kids' lists); names open their list, or their latest earlier one. Claims are never shown to the person a list is for. Organizer tools are under Manage on each page.
- **Getting people in:** a family link for the group chat (all years, names and wanted gifts, never claims). "This is me" emails that person a one-tap sign-in link back to the list they had open. "Ask to join" takes a name and email; Hudson taps Add or Decline under Manage (a count shows beside Manage).
- **Import:** upload the gift sheet (.xlsx), review per tab (me, someone in the group, a kid, kids together with split rows, just a name, skip), pick the group, import. Afterwards, Manage › "Lists under just a name" connects name-only lists to a person, every year at once.
- **Sample family** with View as, for trying things without real data.

### Left to do before the family uses it (Hudson)

1. **Check it on your phone in Safari.** Automated tests use Chromium emulating an iPhone.
2. **Run the real import** of "2025 Ford Family Christmas Gifting": pick the family group and go tab by tab, in any order. Then use Connect for any name-only lists that belong to someone with an account.
3. **Go / no-go before inviting anyone:** who sees what, claim surprises protected, a walkthrough as a family member. Nothing goes to family until Hudson says so.
4. Then share the family link in the group chat.

### Known issues

1. **No email to Hudson for join requests:** only the count beside Manage on the family page.
2. **Admin group page** lists everyone on warbag with a checkbox; needs search once the family is all in.
3. The Connect button has no browser test (its rules are covered by database tests).

### Later (parked)

- Turn off the family link once everyone has an account.
- Request-a-group for non-admins; photos (upload or image link); automatic link previews; list/grid view; drag to reorder; Chirk gift-exchange link; screenshot import.
- Last Gyfte-specific ChatGPT review: WRB-20261121-07; last Gyfte-specific Claude note: WRB-20261121-06 v2.

### Where to pick up

Start with step 1 above (the import review reset was fixed in PR 26). Decisions behind all of this are in docs/DECISIONS.md (newest first); words in docs/LANGUAGE.md.

## Waiting on

- App packages kept somewhere permanent (Hudson); old app data exports when each app is rebuilt.
