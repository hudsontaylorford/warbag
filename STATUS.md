# Status

**2026-11-23.** Mosey is the priority, aiming at a private family trial on **December 1**. Gyfte is paused and ready for Christmas. Everything below is live at https://warbag.rodeo (last change: PR 64, Mosey cleanup). Screenshots of every Mosey page, phone and desktop, made-up data: Drive "Warbag — AI Handoffs" › "Mosey · All pages · current (after PR 55, 2026-11-23)"; latest Claude note: WRB-20261123-01.

## Mosey (trip planner)

### Live
- **Plan:** a calendar of the trip on top (tap a day to jump to it), then one card per day with an optional area and tag, Today, and days already over collapsed. One "+ Add to this day" per day. Organizers can **Reorder** a day (times set the order; untimed stops go anywhere).
- **Stops:** typed "When" the Crewmaxxing way (7pm, 9:30a, Morning, TBD); status (Tentative, Inquiry sent, Confirmed, Booked); meals (Breakfast, Lunch, Dinner, Food & drink) with "Who's handling it"; members-only details hidden on view links.
- **Who's going:** only on stops that ask ("Ask who's going"), from the trip's people list; one tap "I'm going" / "Maybe".
- **Options:** "Monday afternoon: ski, hike or spa" as one block; each person picks one; "Who picked what".
- **Ideas:** Food & drink filter; "Move to a day" opens the days as buttons; pasting a link files it as the link.
- **Money:** expenses, payments already made, people and households, settle-up (Direct or through one person), frozen versions, change log. **Kids** are on the trip but left out of splits unless ticked in (their share goes to their household); they never pay.
- **Receipts:** photo → AI draft → a person checks and saves. Paper rules (handwritten tips, card slips), asks when unsure (tip tables, added tips, lines that don't add up), never guesses a date, warns about IDs or cards in the photo, unsaved photos can be discarded. Checked on 8 of Hudson's real receipts: 7/8 (the miss: a handwritten 4 read as a 9; the form asks and "Something else" covers it).
- **Getting people in:** **Invite by email** from Manage (on warbag and the trip in one step, as Member or Co-organizer, with an email naming the trip). The **trip link** (anyone sees the plan and ideas, never money or names) has **Join this trip**: name and email, now or later; the owner taps Add under Manage → Asking to join. Clear pages when you have no trips or open a trip that isn't shared with you, saying who you're signed in as.
- **Sharing:** members, **co-organizers** (everything except sharing or deleting the trip), the trip link.
- **Editing:** one editor open at a time, named ("Editing: Van pickup"); unsaved changes are kept until Save or Cancel; Save closes it with "Saved ✓". Settings (Manage, People, Account) save themselves.
- **Test trips:** Maine and North Shore entered and compared with the sheets: they match, except the Maine cabins, which the sheet marks as paid directly.

### Left before December 1 (Hudson)
1. **iPhone walkthrough in Safari** (automated tests emulate an iPhone in Chromium).
2. **Christmas trip tidy-up:** on Money → People and households, tick **Kid** for the three kids and check their households (assignments were provisional; one name may be Lenox or Lennox). Link your own account to your name to get the one-tap "I'm going" and "Pick this".
3. **Discard the test receipt photos** on the live trip (Money → "photos not saved as expenses").
4. **Go / no-go** before inviting anyone, then send the family the **trip link** (Manage → Trip link) and add people as they ask. Nothing goes to family until Hudson says so.
5. Agent test of the access and editing fixes (running 2026-11-23).

### Open questions (from the Christmas trip notes)
- Duplicate "Ford Family" groups (one empty) look the same in pickers; clean up deliberately.
- Christmas dates: Mosey has Dec 17 to 23; another planner says Dec 17 to 24.

### Known gaps
- Inviting new people from a trip needs an admin or people manager (by design; today Hudson and his agent).
- Gyfte's sharing still has its own Share / Save step (Gyfte is paused).

## Room Tuner (room EQ)

### Live
- **Native app at /roomtune**, for Hudson and anyone he ticks it for under People → Apps. One setup per speaker and room; each is private to its owner.
- **The same tool as the old page, in warbag's look:** play pink noise, record rounds at 3 spots, upload, see the room against the target, copy the suggested slider values, save presets, measure band width. Recordings are analyzed in the browser (Lossless included); only 55 numbers per recording are saved.
- **Saved to your account** after each change, confirmed by the server. **Import setups** reads the old page's export file. **View link** per setup for anyone without an account.
- **Fill from a screenshot** on a new setup reads the speaker app's EQ screen, using Mosey's Anthropic key.

### Left (Hudson)
1. **Import your setup:** Room Tuner → Import setups → `room-tuner-setups.json`.
2. **Try it on your phone in Safari**, including a Voice Memos upload and Fill from a screenshot (automated tests use Chromium; screenshot reading has no automated test because it calls Claude).
3. **Turn off the old page's public link** (claude.ai artifact "Room Tuner": set it to private), once you're happy here.

### Next (needs Hudson's go)
- Its own roadmap is in docs/ROOMTUNE.md; first up is an unprocessed iPhone recorder.

## Accounts and access

- **Assistant (agent) access**, Hudson's decision 2026-11-23: its own non-admin account. It can be a trip's **co-organizer** and a **people manager** (invite people, manage groups and app access; never its own access or an admin's, no removing people or deleting groups). It never gets admin.
- Setting it up (🟢 PRODUCTION, warbag.rodeo): People → Invite someone (the agent's email) → open it → tick **People manager**; give it **Mosey** under Apps if it should start trips; on each trip, Manage → **Co-organizers** → tick it.
- An agent's browser starts fresh each run, so it signs in with an email code every time. For read-only review, a trip's view link needs no sign-in.
- **Roadmap (each needs Hudson's go):** signed-in devices on Account, passkeys, a dedicated assistant identity with revocable tokens and an audit trail.

## Gyfte

**2026-11-22. Gyfte is paused, feature-complete for Christmas 2026 and not yet opened to the family.** Everything below is live at https://warbag.rodeo (last change: PR 24). Screenshots of every page, phone and desktop, made-up data: Drive "Warbag — AI Handoffs" › "Warbag · All pages · current (after PR 24, 2026-11-21)".

### What's live

- **warbag:** invite-only email-code sign-in, access rules (users, groups, per-item grants, share links, audit log), People admin, the launcher ("Hi, Hudson" on navy; Gyfte plus Chirk and Crewmaxxing as external links), a public page with only the name and Sign in.
- **Look:** paper and navy palette, serif titles, W and G monograms, no slogans or decorative marks (personal app). See docs/DESIGN.md.
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
- A Claude → ChatGPT note on the latest round, only if Hudson asks. Last ChatGPT review: WRB-20261121-07; last Claude note: WRB-20261121-06 v2.

### Where to pick up

Start with step 1 above (the import review reset was fixed in PR 26). Decisions behind all of this are in docs/DECISIONS.md (newest first); words in docs/LANGUAGE.md.

## Waiting on

- App packages kept somewhere permanent (Hudson); old app data exports when each app is rebuilt.
