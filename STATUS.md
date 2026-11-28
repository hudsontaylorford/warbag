# Status

**2026-11-28.** Mosey is ready for a private family trial on **December 1** with the Ford Christmas Trip (Dec 17 to 24); what's left is Hudson's own checks. Gyfte is paused and ready for Christmas. Room Tuner and Jot are live for Hudson. Everything below is live at https://warbag.rodeo (last change: PR 90).

- **Next and later:** ROADMAP.md. **Why:** docs/DECISIONS.md (newest first). **Words:** docs/LANGUAGE.md. **Look:** docs/DESIGN.md.
- **Drive, "Warbag — AI Handoffs":** latest Claude note WRB-20261124-01 v2 (this status and the full roadmap); latest Instinct notes WRB-20261123-02 (newcomer field test), WRB-20261127-01 (People cleanup brief) and WRB-20261127-02 (agenda view, answered in v2); screenshots of every Mosey page, phone and desktop, made-up data: "Mosey · All pages · current (after PR 90, 2026-11-28)".

## Before December 1 (Hudson)

1. **Christmas trip tidy-up:** Money → People and households: tick **Kid** for the three kids and check their households (one name may be Lenox or Lennox); link your own account to your name. On the Plan, fill in **Staying** for the nights you move (More for this day → Add area, tag or staying).
2. **People cleanup** (WRB-20261127-01): Gyfte → Family → Sample family → **Delete sample family**; then rename the 2-person "Ford Family" to "Ford Family (old)", check nothing uses it (the trip's Who's on the trip, Gyfte families, list sharing), and delete it. Keep or remove "Instinct test (newcomer)": your call (suggested: keep until after the trial).
3. **Discard the test receipt photos** on the live trip (Money → "photos not saved as expenses").
4. **Check the sender name:** sign out and in; the code email should come from **Hudson** (`warbag@chirk.fyi`).
5. **Pick how family join:** Ask to join (you tap Add; they sign in with an email code; verified by Instinct) or **Join and edit, no sign-in** (Manage → Trip link; not yet tried by a person). Then an Instinct real-phone run of that path and your own **iPhone walkthrough in Safari** (automated tests emulate an iPhone in Chromium).
6. **Go / no-go,** then send the family the **trip link** (Manage → Trip link → Share link). Its preview reads "You're invited: Ford Christmas Trip". Nothing goes to family until Hudson says so.

Not yet checked anywhere: a real iPhone; the "No code?" wording after Send code; the "you've been added" email arriving; PRs 66 to 90 by a person.

## Mosey (trip planner)

### Live
- **Plan:** the trip one line per day on top (the day's stops in plan order with short times; flags only for Tentative, Inquiry sent and Pick one; the day's area and tag; "Staying" where it changes; tap a row to jump to its card). Then one card per day: optional area, tag and members-only **Staying**; Morning / Afternoon / Evening / Any time headings when a day spans more than one; Today marked; days already over collapsed; one "+ Add to this day"; organizers can **Reorder** (times set the order; untimed stops go anywhere) and **Add options**.
- **Stops:** typed "When" the Crewmaxxing way (7pm, 9:30a, Morning, TBD); status (Tentative, Inquiry sent, Confirmed, Booked); meals (Breakfast, Lunch, Dinner, Food & drink) with "Who's handling it"; notes fold to one line on the Plan with "Show all"; members-only details hidden on the trip link.
- **Who's going:** only on stops that ask ("Ask who's going"), from the trip's people list; one tap "I'm going" / "Maybe".
- **Options:** "Monday afternoon: ski, hike or spa" as one block; each person picks one; "Who picked what".
- **Ideas:** Food & drink filter; "Move to a day" opens the days as buttons; pasting a link files it as the link.
- **Money:** expenses, payments already made, people and households, settle-up (Direct or through one person), frozen versions, change log. **Kids** are on the trip but left out of splits unless ticked in (their share goes to their household); they never pay.
- **Receipts:** photo → AI draft → a person checks and saves. Paper rules (handwritten tips, card slips), asks when unsure, never guesses a date, warns about IDs or cards, unsaved photos can be discarded. 7 of Hudson's 8 real receipts read right (the miss: a handwritten 4 read as a 9; the form asks).
- **Getting people in:**
  - **Invite by email** from Manage (a sign-in and the trip in one step, as Member or Co-organizer; the email names the trip).
  - The **trip link** (`/m/…`): anyone sees the plan and ideas, never money or members-only details, and can **Join this trip** with a name and email; the owner taps Add. Its link preview: "You're invited: <trip>", dates and place, and a card.
  - **Join and edit, no sign-in** (off by default per trip; Manage → Trip link): people pick their name and become members without an account, each with their own link; Money is a separate switch; receipt photos need a sign-in.
  - Someone signed in who opens a trip's own address without being on it gets **Ask to join** right there (same answer whether or not the trip exists). Signed out, the sign-in page says "Sign in to Mosey" and points at the trip link.
  - When someone asks, the owner sees "N asking to join · Review" at the top of the trip; Manage opens with the request first.
- **Roles:** Member (sees everything, adds ideas and expenses, suggests a day); **Co-organizer** (everything except sharing or deleting the trip); the owner.
- **Manage:** organizers get **Manage** beside Plan / Ideas / Money; the trip link sits at its top with **Share link** (phone share sheet) and Copy.
- **Editing:** one editor open at a time, named ("Editing: Van pickup"); unsaved changes kept until Save or Cancel. Settings (Manage, People, Account) save themselves.
- **Readability:** every Mosey page and sign-in measured at iPhone size (2026-11-28): all text passes WCAG AA; tap targets at least 44px.

### Field tests so far
- **Hudson's Christmas trip entry, 2026-11-22** (WRB-20261122-02): drove PRs 33 to 50.
- **Instinct newcomer test, 2026-11-23** (WRB-20261123-02): a dead end on the trip's app address, fixed in PR 65; the rerun verified Ask to join, the trip link signed out, member controls, edits that persist, Who's going and Delete. Its follow-ups were fixed in PR 66.
- **Instinct agenda proposal, 2026-11-27** (WRB-20261127-02): parts 1 to 3 shipped (PRs 87 to 89); a swipe-between-days screen is held until after the trial.

### Known gaps
- Inviting new people from a trip needs an admin or people manager (by design; today Hudson and his agent).
- Nobody is emailed when someone asks to join a trip; the owner sees "N asking to join" at the top of the trip.
- Flooding a trip's page with join requests reveals that the trip exists ("try again in an hour"); the address is a random id nobody can guess, so this is accepted.
- Test trips Maine and North Shore match their sheets, except the Maine cabins (paid directly).

## warbag (the hub) and accounts

### Live
- **Launcher, "Masthead"** (PR 67): navy field, a big cream "Hi, Hudson", app names only under **Apps** and **Other sites** (Chirk, Crewmaxxing ↗). Two columns on desktop.
- **App first** (2026-11-27): only admins, people managers and people with two or more apps see warbag (the header link, the launcher). Everyone else sees just their app: signing in lands there; tab titles, tab icons (M, G, R, J), share pages, the sign-in page and emails name the app. Emails come from "Hudson" at `warbag@chirk.fyi`.
- **Letters:** each page's header shows its place's letter, bare, in ember (G Gyfte, M Mosey, R Room Tuner, J Jot, P People, A Account); W is warbag itself.
- **Link previews** (2026-11-27): Mosey trip and guest links, Gyfte list and family links, Room Tuner view links preview like Chirk's, in the app's look, never naming warbag.
- **Sign-in:** invite only, email code or link; it says so plainly when no code arrives.
- **People:** invite, groups, app access per person or group, **people managers** (invite, groups, app access; never their own access or an admin's), and **admins** (People → a person → Admin → Make admin, after a confirm; never yourself, never a guest or sample person, always at least one admin, logged). Admins never open anyone's lists, notes or trips.
- **A way back:** People and Account remember the page you came from ("‹ Back to Ford Christmas Trip"); every page has a "‹" link up.
- **Assistant (Instinct):** its own non-admin account, a people manager, co-organizer on the trips Hudson picks; never admin. It joins the Drive handoff protocol (only when Hudson asks). Its browser starts fresh each run, so it signs in by email code each time; a trip link needs no sign-in.

### Next (each needs Hudson's go)
- Launcher: show, hide and reorder your own apps; personal bookmarks.
- Sign-in: signed-in devices on Account, passkeys, a dedicated assistant identity (see ROADMAP.md).
- Kept for later, not approved: "press and arrive" motion from a launcher row into the app's header.

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

## Gyfte

**Paused since 2026-11-22, feature-complete for Christmas 2026 and not yet opened to the family.** Since then it has picked up the hub's changes: app-first branding (family see "Gyfte", not warbag), share-link previews, and its own tab letter. Screenshots (made-up data, before those changes): Drive "Warbag — AI Handoffs" › "Warbag · All pages · current (after PR 24, 2026-11-21)".

### What's live

- **Gyfte, everyday:** three tabs: My list (yours and your kids'), Family (opens your family group), I'm getting (your claims). Lists for Christmas and birthdays; one add box, bulk add, star, Got it, History (read-only after the date plus 14 days, "Edit history" to change), copy to this year (owner or a co-parent).
- **Gyfte, family:** family groups (year › people › lists, kids nested under parents, joint kids' lists); names open their list, or their latest earlier one. Claims are never shown to the person a list is for. Organizer tools are under Manage on each page.
- **Getting people in:** a family link for the group chat (all years, names and wanted gifts, never claims). "This is me" emails that person a one-tap sign-in link back to the list they had open. "Ask to join" takes a name and email; Hudson taps Add or Decline under Manage (a count shows beside Manage).
- **Import:** upload the gift sheet (.xlsx), review per tab (me, someone in the group, a kid, kids together with split rows, just a name, skip), pick the group, import. Afterwards, Manage › "Lists under just a name" connects name-only lists to a person, every year at once.
- **Sample family** with View as, for trying things without real data.

### Left to do before the family uses it (Hudson)

1. **Check it on your phone in Safari.** Automated tests use Chromium emulating an iPhone. The readability and tap-size check done for Mosey hasn't been run on Gyfte yet.
2. **Run the real import** of "2025 Ford Family Christmas Gifting": pick the family group and go tab by tab, in any order. Then use Connect for any name-only lists that belong to someone with an account.
3. **Go / no-go before inviting anyone:** who sees what, claim surprises protected, a walkthrough as a family member. Nothing goes to family until Hudson says so.
4. Then share the family link in the group chat.

### Known issues

1. **No email to Hudson for join requests:** only the count beside Manage on the family page.
2. **Admin group page** lists everyone on warbag with a checkbox; needs search once the family is all in.
3. The Connect button has no browser test (its rules are covered by database tests).

### Later (parked)

- Turn off the family link once everyone has an account.
- Request-a-group for non-admins; photos (upload or image link); previews of gift links inside a list; list/grid view; drag to reorder; Chirk gift-exchange link; screenshot import.
- Last Gyfte-specific ChatGPT review: WRB-20261121-07; last Gyfte-specific Claude note: WRB-20261121-06 v2.

### Where to pick up

Start with step 1 above (the import review reset was fixed in PR 26). Decisions behind all of this are in docs/DECISIONS.md (newest first); words in docs/LANGUAGE.md.

## Waiting on

- App packages kept somewhere permanent (Hudson); old app data exports when each app is rebuilt.
