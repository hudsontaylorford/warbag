# Status

**Mosey (2026-11-22):** PR 1 live (visible only to Hudson and trip members): trips, day-card Plan, Ideas with organizer "Add to plan", members, view link (/m/…) that hides members-only details. PR 2: the money math library (no screens), checked against the Maine and North Shore sheets privately (Maine to the penny; North Shore within the sheet's own 1¢ rounding). PR 3: expenses, payments already made, people and households, settle-up (Direct or through one person), frozen versions, change log. PR 4: receipt photos with AI drafts, live (Hudson set up the private Blob store and API key, SETUP.md Part G, 2026-11-22). Left before the December 1 family trial: Hudson's first real receipt test, a real iPhone walkthrough, entering Maine and North Shore in Mosey to compare with the sheets, then the go / no-go before inviting anyone. Safety fix (2026-11-22): removing an account moves their trips to the admin instead of deleting them, and an expense saved from a receipt saves in one step, never twice. Paper receipts (2026-11-22): the reader follows handwritten tips and card slips, asks when it isn't sure of the total, never guesses a date, and unsaved photos can be discarded. Not yet checked against Hudson's real photos (no API key in Claude's session); Hudson re-tests on the live site. Known gap: a deleted trip's receipt photos stay in the Blob store. Target: private family trial December 1.

## Gyfte

**2026-11-22. Gyfte is paused, feature-complete for Christmas 2026 and not yet opened to the family.** Everything below is live at https://warbag.rodeo (last change: PR 24). Screenshots of every page, phone and desktop, made-up data: Drive "Warbag — AI Handoffs" › "Warbag · All pages · current (after PR 24, 2026-11-21)".

## What's live

- **warbag:** invite-only email-code sign-in, access rules (users, groups, per-item grants, share links, audit log), People admin, the launcher ("Hi, Hudson" on navy; Gyfte plus Chirk and Crewmaxxing as external links), a public page with only the name and Sign in.
- **Look:** paper and navy palette, serif titles, W and G monograms, no slogans or decorative marks (personal app). See docs/DESIGN.md.
- **Gyfte, everyday:** three tabs: My list (yours and your kids'), Family (opens your family group), I'm getting (your claims). Lists for Christmas and birthdays; one add box, bulk add, star, Got it, History (read-only after the date plus 14 days, "Edit history" to change), copy to this year (owner or a co-parent).
- **Gyfte, family:** family groups (year › people › lists, kids nested under parents, joint kids' lists); names open their list, or their latest earlier one. Claims are never shown to the person a list is for. Organizer tools are under Manage on each page.
- **Getting people in:** a family link for the group chat (all years, names and wanted gifts, never claims). "This is me" emails that person a one-tap sign-in link back to the list they had open. "Ask to join" takes a name and email; Hudson taps Add or Decline under Manage (a count shows beside Manage).
- **Import:** upload the gift sheet (.xlsx), review per tab (me, someone in the group, a kid, kids together with split rows, just a name, skip), pick the group, import. Afterwards, Manage › "Lists under just a name" connects name-only lists to a person, every year at once.
- **Sample family** with View as, for trying things without real data.

## Left to do before the family uses it (Hudson)

1. **Check it on your phone in Safari.** Automated tests use Chromium emulating an iPhone.
2. **Run the real import** of "2025 Ford Family Christmas Gifting": pick the family group and go tab by tab, in any order. Then use Connect for any name-only lists that belong to someone with an account.
3. **Go / no-go before inviting anyone:** who sees what, claim surprises protected, a walkthrough as a family member. Nothing goes to family until Hudson says so.
4. Then share the family link in the group chat.

## Known issues

1. **No email to Hudson for join requests:** only the count beside Manage on the family page.
2. **Admin group page** lists everyone on warbag with a checkbox; needs search once the family is all in.
3. The Connect button has no browser test (its rules are covered by database tests).

## Later (parked)

- Turn off the family link once everyone has an account.
- Request-a-group for non-admins; photos (upload or image link); automatic link previews; list/grid view; drag to reorder; Chirk gift-exchange link; screenshot import.
- A Claude → ChatGPT note on the latest round, only if Hudson asks. Last ChatGPT review: WRB-20261121-07; last Claude note: WRB-20261121-06 v2.

## Where to pick up

Start with step 1 above (the import review reset was fixed in PR 26). Decisions behind all of this are in docs/DECISIONS.md (newest first); words in docs/LANGUAGE.md.

## Waiting on

- App packages kept somewhere permanent (Hudson); old app data exports when each app is rebuilt.
