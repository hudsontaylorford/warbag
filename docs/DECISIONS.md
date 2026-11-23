# Decisions

Durable decisions, newest first. Each one says what was decided and why. When a decision changes, add a new entry and mark the old one superseded rather than editing history.

## 2026-11-23 · Fix: deleting a trip with expenses

Found while making screenshots: Delete trip failed for any trip with expenses (the cascade removed the trip's people before their expense rows, so a reference check fired too early). The person references on expenses and payments are now checked when the delete finishes (deferrable, migration 0023). Removing one person is still refused in code while they're in expenses or payments. Test: a trip with expenses, payments and a frozen statement deletes completely and leaves other trips alone.

## 2026-11-23 · People managers (the agent can manage people and groups)

Hudson wants the agent to have People and groups access, without admin. Chosen level (asked): **People manager**.

- **Can:** see People and groups, invite people, rename people, create, rename and edit groups and who's in them, give people and groups app access.
- **Can't:** change its own apps or groups, change an admin (name, apps, groups, or remove an admin from a group), give apps to a group it's in, remove people, delete groups, make anyone an admin or a people manager. All checked in `src/lib/people.ts` on the server; screens hide what it can't do.
- **Admins set it** on a person's page (People manager), never on themselves. Turning it off applies on the next request.
- Why the self and admin limits: whoever edits groups could otherwise widen their own access (join the family group, give themselves apps) or take an admin's away.

## 2026-11-23 · Mosey: co-organizers (and an agent with full control)

Hudson: an agent with basically full control is fine, without admin.

- **Co-organizers** on a trip (Manage → Co-organizers, people only): a `manage` grant. They do everything the owner can on that trip: plan, ideas, options, who's going, people, money, settle-up, trip details.
- **Owner-only (or an admin):** who the trip is shared with (members, co-organizers, view links) and deleting it. So a co-organizer, including an agent, can't hand the trip to anyone else or delete it.
- **Never admin:** People, groups and app access stay with admins. The agent signs in to its own account (email code to its inbox each run).
- Saving the members list never downgrades a co-organizer; removing one takes effect on their next request.
- CLAUDE.md's assistant rule updated to match (own non-admin account; Hudson decides how much it can do).

## 2026-11-23 · Sign-in: why the agent keeps getting signed out

- Diagnosis: nothing in warbag ties a session to an IP address. Sessions last 60 days and refresh daily; Better Auth 1.7.18 stores the sign-in IP and browser as a record only, and uses the IP (from `x-forwarded-for`) just for sign-in rate limits. The sign-outs Hudson saw were an agentic operator's browser, which starts from a fresh profile each run and keeps no cookies, so each run is signed out.
- No owner password and no sharing Hudson's session with an agent. For now an agent reviews trips through a read-only view link; a proper assistant identity, passkeys and signed-in devices are on the roadmap.

## 2026-11-23 · Mosey: reordering stops in a day

- **Times set the order;** untimed stops (Any time, Time TBD) can be placed anywhere, and stops at the same time can swap. Moving an untimed stop next to another gives it that stop's time as its place (`mosey_stops.sort_at`), so "Groceries on the way" stays between the 12:00 pickup and the 1:30 drive. Two stops at different times can't swap: "Times set the order. Change its time to move it there."
- **A Reorder mode** on the day card (organizers, two or more stops): up and down buttons on each row while it's on, Done to leave. No buttons on everyday rows; tap and keyboard, no drag.
- Change: Time TBD and Any time no longer have a fixed order between them; they keep the order people give them (supersedes that line in "typing when a stop happens").
- Not here: moving between days (use Move to Ideas or Move to a day), drag and drop.

## 2026-11-23 · Mosey: competing options

For plans like "Monday afternoon: ski, hike or spa", the pattern group-trip apps use for "who's in" (choices, not per-line RSVPs).

- **Options are a group of two or more stops on one day** (`mosey_choices`, `mosey_stops.choice_id`). Organizers add them with "+ Add options" on a day (what's being decided, an optional When for all of them, the options), or group an existing stop from its More ("Part of options"). Each option is a normal stop: its own time, place, status, meal.
- **One pick per person:** "Pick this" / "Your pick" on each option; picking another moves it (server-enforced; "maybe" isn't a pick). "Who picked what" lists everyone, with how many haven't picked; organizers can set anyone's pick there.
- **One block on the day card,** placed where its first option falls in the day; a When all options share shows once in the header.
- **Ungroup** keeps the stops and the picks. Moving or deleting options until one is left dissolves the group; the last one stays an ordinary stop.
- View links show the options and their titles, never who picked what. Not here: a "decided" state, options in Ideas, deadlines to pick.

## 2026-11-23 · Mosey: ask who's going only where it matters

Hudson: "Who's going?" on every stop felt like an extra button. Research: group-trip apps put "who's in" on choices (voting on activities), event apps show a compact tappable summary of who's coming, and family reunions RSVP once for the trip and opt in only to extras.

- **Everyone by default.** A stop shows nothing about attendance unless someone ticks **Ask who's going** in its form (for a split day, limited seats, an optional night out). Marking is refused on stops that don't ask. Stops already marked before this change keep asking.
- **One tappable summary** on those stops ("Going: Ann, Ben, Cal · Maybe: Dee", or "Who's going?") opens the full list; organizers mark anyone there, everyone else sees it read-only except their own row.
- **You mark yourself in one tap** on the stop: "I'm going" / "Maybe" (tap again to clear), for anyone linked to a name on Money.
- Supersedes the per-stop "Who's going?" link in "stop status and who's going" below. Later, maybe: linking competing options ("Monday: ski, hike or spa") as one choice.

## 2026-11-23 · Mosey: meals

From the Christmas-trip notes (WRB-20261122-02 section 11): meals live inside the plan and Ideas, not a fourth tab or a separate meal planner.

- **Any stop or idea can be a meal:** Breakfast, Lunch, Dinner, or Food & drink (restaurants, takeout, a grocery run), plus an optional "Who's handling it" ("Ann cooking, Cal brings pie"), hidden on view links for members-only stops like notes.
- **On a day card,** a meal with no time shows "Dinner" where the time goes and sits at its usual hour (breakfast 8, lunch 12:30, dinner 6:30); a timed meal shows a quiet "Lunch" beside its name. Status (Tentative, Confirmed...) works as for any stop.
- **Ideas has a Food & drink filter** for competing options; moving one to a day moves the same record, never a copy.
- **Not here (later, opt-in):** meal budgets (a budget is an estimate, never an expense), shopping checklists, cooking assignments, AI menus.
- Also: "Who's going?" only appears once the trip has people on Money.

## 2026-11-23 · Mosey: kids on the trip, adults in the money

Hudson's choice (asked, Nov 23): **adults only by default.**

- **A "Kid" setting on each person** on Money (organizers). Kids stay on the one people list: the plan, who's going, and Money's People section.
- **Splits:** a new expense starts with every adult ticked and every kid unticked ("All adults"); a kid added later stays out. Ticking a kid in counts their share toward their household (households already settle as one). A kid with no household can't be ticked in, so a share never lands on a child alone.
- **Kids never pay or get paid:** not in Paid by or payments, refused on the server too, and never the person everyone settles through.
- **Nothing old changes.** Expenses keep exactly who they were split with. Marking someone a kid is refused if they paid for something or are in a payment, or if they're in splits with no household (their balance would otherwise sit on them).
- A kid who's in no split isn't listed in settle-up.

## 2026-11-23 · Mosey: stop status and who's going

- **Status:** none, Tentative, Inquiry sent, Confirmed or Booked, chosen in the stop's form by anyone who can edit it; a small label beside the name (Confirmed and Booked filled, the others outlined). View links show it. Words in docs/LANGUAGE.md.
- **Who's going uses the trip's people list** (the people on Money), not a second roster. Each stop and idea shows "Going: … · Maybe: …" and "Who's going?" / "Change". Two choices per person; tapping the one that's on clears it, so not marked never reads as "no".
- **Who can mark:** organizers anyone on the list; a member only the person linked to their own account. Members only: viewers and view links never see names or attendance (checked on the server, like money). Removing a person removes their marks.
- **Kids:** stay on the people list, so they can be marked for stops. Keeping them out of money splits is the separate kids change.
- Not here: votes between options, deadlines and reminders, attendance counts on the calendar.

## 2026-11-23 · Mosey: the Ideas layout

- **No day menu on every idea.** Organizers see one quiet "Move to a day"; it opens the trip's days as buttons ("Fri 17") and one tap puts the idea on that day. An idea someone suggested for a day shows "Add to Tue, Dec 21" (one tap) and "Other day". Inside a day card's "Suggested for this day", the same shortcut appears.
- **Pasting a link** into an add box (Ideas or a day card) files it as the link and asks "What is it?", instead of making the link the title.
- Members still suggest a day by adding from that day's card; organizers decide what goes on the plan.

## 2026-11-23 · Mosey: typing when a stop happens

- **One "When" box, typed like Crewmaxxing.** "7pm", "9:30a", "14:30", "930", "noon". A bare hour is read the likely way (7 to 11 morning, 12 to 6 afternoon) and the box says "Read as 9:00 AM. Add a or p to change."; on leaving the box it shows the full reading. The parser is copied from Crewmaxxing (`src/lib/time-input.ts`, same tests) so both apps read times the same; keep them in step.
- **Parts of the day and TBD:** one tap for Morning, Afternoon, Evening or TBD, or type them. Empty is still any time. Stored as `time_of_day` next to the exact time (never both).
- **Order in a day:** a part of the day sorts at the start of its window (morning from 5am, afternoon from noon, evening from 5pm), before exact times there; then time TBD, then any time.
- Not here: ranges ("2-4"), and times typed in the title ("Dinner at 7"); the second is part of the later natural-language quick add.

## 2026-11-23 · Mosey: day cards and the trip calendar

From Hudson's Christmas-trip test (WRB-20261122-02, sections 2 and 10) and a ticket-calendar screenshot he liked.

- **Mosey's own header:** an M mark (burnt orange) and "Mosey" link to the trip list; "warbag" is a quiet link home on the right. Other apps keep the W for now.
- **A calendar on top of Plan:** the trip's weeks with its days solid and the days around them faded. Each day shows its first time ("6:30p") and "+2" for more, or dots for any-time plans; today is filled navy. Tapping a day jumps to its card. Shown for trips longer than a day.
- **One card per day:** a raised card with the date, "Day 3", and an optional area and tag ("Brooklyn → Hillsdale · Travel day"). Today gets a "Today" mark and a darker border. Once a trip is under way, days already over start collapsed with a count; any day can be collapsed or opened.
- **One add action per day:** "+ Add to this day" opens the add box (and focuses it) instead of a box always open on every day. Members see "Suggest for this day".
- **Area and tag:** free text, both optional, organizers only, set from the card ("Add area or tag"); tag suggestions are Travel day, Flexible, Rest day, Free day. Stored per trip day (`mosey_days`); a day outside the trip's dates isn't shown. View links show them.
- **Not in this change:** reordering stops, easier time entry, the Ideas layout, stop status and attendance.

## 2026-11-22 · Mosey: paper receipts

Hudson's first real tests were paper restaurant receipts, not app receipts. One of three got the wrong total (Bar Oliver: it suggested $338.97, the 22% row, without asking; Hudson's card statement later confirmed $338.97, so the problem was being sure without a way to check, not the amount), and an obscured date silently became the trip's first day.

- **The reader follows paper rules:** handwriting overrides print; a suggested-tip table is options, not a charge; a printed gratuity line is already in the total; the signed card slip beats the itemized check; with no tip written, the printed total stands. Effort raised from low to medium for handwriting and faded thermal paper (still a few cents a receipt).
- **Tip tables and added tips always ask (Nov 23).** The first real-photo run scored 6/8; Bar Oliver came back fully confident from a ticked tip-table row, with no way to check it (the statement later showed the amount was right). A prompt can't make tick-reading reliable, so the reader now lists every tip-table row (marked or not, even cut-off ones) and says where its total came from. When the total came from a tip table, or from adding a handwritten tip to an unreadable written total, the form fills in nothing and offers every row's total, marked rows first, plus "Something else". Printed and written totals still fill in.
- **The receipt's own arithmetic is checked (Nov 23).** The reader copies the lines the printed total adds up from (subtotal, taxes, fees, printed gratuity, discounts). If they don't add up to the total it read, a digit was misread, so the form asks and offers both (Sobre Masa read $167.86; its lines give $167.66). Known limit: Cozy Royale's handwritten 4 reads as a 9; the form asks and "Something else" covers it.
- **Unsure means ask.** When more than one amount could be the charge, the form fills in none and asks "Which total was charged?" with each amount and where it came from, plus "Something else".
- **Dates are never guessed.** From a photo, an unreadable date stays empty and must be chosen ("Choose the date on the receipt."). Past dates are fine.
- **Unsaved photos can go.** "Discard photo" under the form, and a "photos not saved as expenses" list on Money with Use it and Discard. The uploader or an organizer can discard; a photo saved with an expense stays. Discarding deletes the image from the Blob store too.
- **IDs and cards in the photo:** the reader flags a photo that also shows an ID, payment card or other personal document, and the form says so: "Only trip members can see it, but you can discard it and retake the photo without it." No automatic blurring (unreliable); the photo stays members-only.
- **Checking against real receipts:** `npm run eval:receipts` runs the real reader over a private folder of photos and an expected.json (RECEIPT_EVAL_DIR, ANTHROPIC_API_KEY). Real receipts never go in the repo or the normal tests.

## 2026-11-22 · Mosey safety: account removal and receipt saves

- **Removing an account never deletes trips.** The trips that person organizes move to the admin doing the removal, with every expense, payment, statement and receipt; the confirmation says how many. Their name stays on the trip's money, unlinked from the account. The database refuses to delete an account row that still organizes a trip (`on delete restrict`), so nothing outside the app's removal can cascade either.
- **An expense and its receipt save together.** Saving from a photo is one transaction: both happen or neither does. A receipt already saved as an expense is refused ("This receipt is already saved as an expense."), so a double tap or a retry can't create a duplicate. Found in ChatGPT's review WRB-20261122-02.

## 2026-11-22 · Mosey PR 4: receipt photos with AI drafts

- **The AI suggests, a person saves.** A photo produces a suggested merchant, date, total and short description, shown in the expense form marked "Filled in from the photo. Check it before saving." It never picks who paid or who shares; nothing reaches the ledger until someone taps Add expense. Manual entry always works, and the form says so when reading fails or isn't set up.
- **Model:** Claude Opus 5.5 (`claude-opus-5-5`, the current default), structured output against a fixed schema, effort `low`, server-side refusal fallback on. About a cent per receipt. Text on a receipt is treated as data, never instructions; card and account numbers are never put in any field.
- **Privacy:** the browser redraws each photo as a JPEG of at most 2000px before upload, which drops hidden photo data such as GPS. Photos go to a private Vercel Blob store and are only served through `/mosey/receipts/<id>` after a trip-membership check (`no-store`, `nosniff`, noindex). No blob URL reaches a browser; view links and view grants never see receipts. Files are checked by their bytes (JPEG, PNG, WebP), 4 MB max (Vercel caps requests at 4.5 MB).
- **Duplicates:** a warning when the same photo was uploaded before, or an expense on the same day for the same amount already exists.
- **Setup:** a private Blob store (`BLOB_READ_WRITE_TOKEN`) and `ANTHROPIC_API_KEY`, Production only (SETUP.md Part G). Without them the receipt button is hidden. Tests never call the real AI.
- **Not yet:** photos of a deleted trip stay in the Blob store (the database rows go); line items, several receipts at once, and auto-posting are out of scope.

## 2026-11-22 · Mosey PR 3: expenses and settle-up

- **People on a trip's money are their own list**: a name, an optional household, and an optional link to a warbag account on the trip (so they see "You owe" on their screen). Organizers manage it; someone already in an expense or payment can't be removed.
- **Members add expenses and payments and change only their own; organizers change anything.** Deleted expenses and payments are kept, marked deleted, and never counted. Every change goes in the change log with before and after.
- **Split defaults to everyone**, with "Everyone" and "Nobody" shortcuts; the form shows "Split N ways, about $X each" before saving and won't save with nobody in the split. People added later are included by default.
- **Settle up shows final payments first**, then each household's share, what they paid or already sent, and a plain sentence on credits ("$412.37 they already put in is taken off their $1,482.06, so only $1,069.69 is left to send"), then a balance check and a copy-ready message. No Venmo requests are sent.
- **Freeze** saves the settle-up as a numbered version that never changes; later edits make a new version.
- **Money is members-only**: no Money tab, data or page for view links or view grants (checked on the server).

## 2026-11-22 · Mosey money rules (PR 2)

- **Whole cents everywhere.** Each person's share is kept exact across the whole trip and rounded once at the end (largest remainder first), so everyone is within a cent of their true share and the shares add up to what was spent exactly. People with identical shares can differ by one cent only when the cents force it.
- **Net = paid + sent - share - received.** "You owe" / "You are owed" in the interface, never negative numbers.
- **Already paid is a payment, not a change to the split** (fixes the old sheet's "P"). Example: three split $120 and one already paid the payer $40: the payer is still owed $40, one person owes $40, the third owes nothing, and all three keep a $40 share. A cost settled outside Mosey (Maine's cabins) can be entered as the split plus the payments, or left out; both give the same result.
- **Households are summed after.** Couples settle as one; people on their own never combine. Nobody pays someone in their own household.
- **Two settle-up styles over the same balances:** Direct (largest debtor pays largest creditor; few payments, not promised to be the fewest) and Through one person (everyone settles with one hub). Choosing one never changes a balance.
- **Checked against the real sheets privately** (downloaded to the session's temporary folder, never committed; automated tests use made-up people only). Maine matches to the penny ($1,211.41 to Hudson + Molly). North Shore matches except one cent: the sheet collected $3,665.88 for $3,665.87 owed; Mosey collects exactly $3,665.87 (Sarah $483.70, Andrew $483.69, identical exact shares).

## 2026-11-22 · Mosey PR 1: trips, Plan and Ideas

- **A trip is a name, a place and a date range;** its days fill in. The Plan is one card per day; Ideas are stops with no day. A stop is a title plus optional time (wall-clock, no time zones), place (with Open in Maps, no Google key), link, notes.
- **Roles reuse the shared access tables** (app "mosey", type "trip"): organizer = manage (owner, plans, shares), member = contribute (adds ideas; a day they pick is a suggestion for an organizer to confirm; edits and deletes only their own ideas), viewer = view.
- **The view link** (/m/…) shows Plan and Ideas without sign-in. Stops marked "Members only" show just their title there: no place, link or notes. Viewers with a view grant see the same.
- **Shortening a trip moves stops on dropped days back to Ideas** instead of deleting them.
- **Who sees Mosey:** people given the app (only Hudson at first) and anyone added to a trip. Money (expenses, settle-up) comes in PRs 2 and 3; receipts with AI drafts in PR 4. Address search (OpenStreetMap) after the trial.

## 2026-11-22 · Next apps (Hudson)

- **Mosey** is the trip planner's name and the next priority after Gyfte. It should reuse what Gyfte, Chirk and CMX already solved; details to come.
- **Room tuner**, a custom Sonarworks-style tool Hudson already built, will be migrated into warbag. Source and timing to confirm.

## 2026-11-22 · Import review keeps choices when the group changes

- Picking the group on the import review no longer reloads the page (every group's people load up front), so who's who, parents, split rows and skips stay as set, in any order.
- Picks that don't fit the new group are cleared rather than kept: a person or parent who isn't in it, and "Someone in the group" when switching to no group. The server still re-checks everything on import.

## 2026-11-21 · Second editorial pass (from WRB-20261121-07)

- **No launcher signature or tagline** (Hudson: warbag is a personal app, not a public product). The faint oversized W was tried and dropped; "What's in your warbag" is replaced by a plain "Hi, Hudson". Colors and fonts unchanged.
- **Desktop launcher uses the width:** headline and apps side by side instead of a stretched phone column.
- **Gyfte, modest:** list pages lead with the person's name; "Christmas 2026" sits above it and the date line no longer repeats the year. Nothing theatrical above forms.

## 2026-11-21 · Connecting name-only lists to people

- **Lists under just a name** (from an import's "Just a name", or a list for someone without an account) can be connected to a person in the group from the group page's Manage, by an admin in that group.
- **Connect moves every year at once** in that group: the person becomes the owner and the one the list is for, the same as if the import had matched them. Claims stay, and are hidden from them like on any list of theirs. Lists in other groups aren't touched. It's in the activity log.
- **It refuses rather than merges** when the person already has a list for the same Christmas; the message names the year.
- **Group pages show name-only people who only have past lists** as a row that opens their latest list, so imported history is reachable before it's connected.

## 2026-11-21 · Ask to join (request with email, Hudson approves)

- **On a family link,** "Not on here? Ask to join" takes a name and email. The reply is "Welcome to Gyfte" and one sentence: once added, come back and tap This is me. It's the same reply whether or not the email already has an account, so the form reveals nothing.
- **Nothing is created until an admin in that group taps Add.** Add creates the account (or finds the existing one) and puts them in the group. No email is sent; This is me on the family link sends the sign-in link. Decline deletes the request. Both are in the activity log.
- **Limits:** one pending request per email per group (a repeat just updates the name), at most 10 new requests per group per hour and 25 waiting. Turning off the family link stops requests. Sample families never take them.
- **Where it shows:** a count on the group page's Manage, and the list inside it. Only admins in the group see requests.
- "Welcome to warbag" is for requests that don't come through a Gyfte link; there are none yet, so only the Gyfte wording exists.

## 2026-11-21 · Gyfte everyday flow (stage 2, from WRB-20261121-07)

- **Three places, one nav:** My list (lists you look after: yours and your kids'), Family (your group; with one family it opens straight to it), I'm getting (your claims). Lists shared with you outside a group still show on My list under "Shared with you", so nothing disappears.
- **Organizer tools are under Manage**, closed by default: groups, new group, sample family and import on Gyfte home; your kids, family link and members on a group page.
- **Sharing is a status line** on a list ("Shared with Ford Family"), opened to change it. Nothing about sharing changed; it's only folded away.
- **Gift rows** keep the star and More in a fixed right column. A group with one year doesn't show a year nav.
- The second editorial pass (one launcher signature, modest Gyfte typography) is a separate PR after Hudson sees this flow.

## 2026-11-21 · Stage 2 answers (Hudson)

- **Family as the landing view** when the way you arrived makes it sensible (a family link or a group page); otherwise Gyfte opens on your own lists.
- **Section headings in the serif**, larger and simpler (a word or two; the year nav carries the year, so headings don't repeat it).
- **After asking to join:** "Welcome to Gyfte" when they came through a Gyfte link, "Welcome to warbag" otherwise, plus one plain sentence on what happens next.
- **Lighter repeated actions:** "I'll get this" and "This is me" are soft filled buttons (still 44px), so gift and people names lead.

## 2026-11-21 · Safety fixes after the look

- **Family-link sign-in returns to the list you opened.** The list page's "go back" carries the list id; the sign-in email's return path is built on the server from ids and only points at a list in that same group (otherwise the group page). Nothing from the visitor becomes a URL.
- **Copy to this year shows for co-parents**, not just the list owner, matching what the server already allowed. It names the group the copy goes into; group names are only shown to members.
- **Import says who will see it:** the review step and the done message name the group the lists are shared with, or say they're private.

## 2026-11-21 · Look and open answers (Hudson)

- **Visual direction: "Editorial OS"** (see DESIGN.md). Paper and navy palette, Instrument Serif titles, one-letter monograms (W, G). The illustrated logo is paused. Hudson chose to do the look before the next round of Gyfte fixes.
- **Imported history is shared** with the group it's imported into (already how the import works; the review will say so plainly).
- **Request to join:** someone without an account can ask to join a group by giving their name and email; Hudson approves before any account exists. Not built yet.
- **Family link scope:** stays as built: anyone with the link sees every year's lists for the group (names and wanted gifts, never claims). It's a bridge until everyone has an account, then Hudson turns it off.

## 2026-11-21 · Import into a group (step 4)

- **The review picks a group** ("Put the lists in"; or "No group (private to me)"). Lists are filed there and shared with it; past years stay read-only.
- **"Who is this?" per tab:** Me; Someone in the group (their history becomes theirs: they own it, the list is for their account); A kid (pick the parent; an existing kid of that parent with the same name is reused, else created); Kids together (split rows: name the kids and a parent, then each row goes to one kid or to "Both / all" on a joint list, unticked rows are skipped); Just a name (managed by the importer, the old behavior); Skip this tab.
- **Starting guesses only:** your tab is Me; members match by first name; a tab naming two people ("Eleanor and Genevieve") starts as Kids together with those names and no parent picked. Split rows start as "Both"; a row that mentions a kid's name shows a hint but isn't moved.
- **Checked on the server before writing** (people and parents must be in the group, 2 to 6 kids for a split, your own group only), written in one transaction, and re-importing skips any person-and-Christmas that already exists.

## 2026-11-21 · Kids under parents (step 3)

- **Kids are their own people in Gyfte** (`gyfte_kids`), no account or email, with one or more parents (`gyfte_kid_parents`). Any group member can add their kid; only parents change a kid or add another parent (someone from one of their groups).
- **Every parent manages the kid's lists.** The parent who starts a list owns it; the others get "Can edit" on it automatically, including parents added later. Parents see claims (they aren't the recipient).
- **Joint lists** are lists for several kids together (`gyfte_list_kids` with 2+ kids), shown as "Eleanor & Genevieve (together)": a shared gift exists once and is claimed once.
- **Year links, bring-forward and Copy to this year follow the kid**, whichever parent started each list; any parent can copy a kid's list forward, and the copy stays in the same group with the same parents.
- **Group page:** kids sit under their first parent in the group with "Start list" for parents; "Your kids" has Add a kid, Add a parent and "Start a joint list". Kids show in every group their parent is in, never in a sample group.
- **Removing a parent** hands their kids' lists to another of the kid's parents (or the admin if none).
- Next: the real import into a group, splitting the joint tab into Eleanor, Genevieve, both (joint list) or skip.

## 2026-11-21 · Family links and "This is me" (step 2)

- **Family link** (`/j/<token>`, one per group, admins only; not for sample groups): Copy, Replace (old link stops) or Turn off on the group page. Anyone with it sees the group's people, years and wanted gifts (received gifts hidden), never claims, without signing in. Signed-in members who open it go to the real group page.
- **"This is me"** next to a member's name emails *that person* a one-tap sign-in link (Better Auth magic link: existing accounts only, single use, one hour, stored hashed), at the address on their account; the page never shows it. Picking someone else's name only sends them an email. Limited to 3 sends per person and 30 per group per 15 minutes.
- Tapping the emailed link signs them in on that device (60-day session) and lands them on the group page, where they can claim and "Start my list". Kids have no button; parents manage them.
- Everyone who joins this way is a normal warbag account (the same one every app uses).
- Not done yet: personal sign-in links to text one person (option C); request-a-group for non-admins.

## 2026-11-21 · Gyfte groups and the sample family (Hudson)

- **A Gyfte group is a page:** group > year > each person's list (Christmas that year, then that year's birthdays). People with no list yet show "No list yet"; you get "Start my list". Year links show only years with lists you can open.
- **Membership is a regular warbag group** (managed on the People screens); every list in a Gyfte group is shared with it ("See and claim"). Group members can open Gyfte and start their own list in the group without separate app access.
- **Only admins create groups.** Others will get a "request a group" step later; Hudson decides (personal app, he manages who can do what).
- **One account everywhere:** anyone who joins through Gyfte gets a normal warbag account, so other apps can be given to them later from the People screens.
- **Sample family** (admins): made-up people (`@sample.invalid`, can never get a sign-in code), a kid managed by "Sample Mom", this year's and last year's lists, a few claims. Kept off your own Lists page. **View as** shows any made-up person's view, read-only; it never works for real people or for non-admins. **Delete sample family** removes the group, its people, lists, claims, grants and links.
- Next: the group link for the family chat with "This is me" (one-tap email to confirm, once per device), then kids under parents, then the real import into a group.

## 2026-11-21 · Gyfte history: read-only by default, copy to this year (ChatGPT note WRB-20261121-04, part B)

- **Past lists are read-only** (History = two weeks after the date). Adding, editing, starring, Got it, bulk add, bring-forward into it, settings and delete are refused on the server unless the manager turns on **Edit history** (a banner with Edit history / Done; forms in that mode send an explicit flag). Imported 2020-2025 lists are therefore locked by default.
- **Sharing stays available on past lists** without Edit history: it doesn't change the record, and sharing old years with family is useful. Claims on past lists were already refused.
- **Copy to this year** (past lists, owner only): pick gifts (unreceived ones ticked, received ones offered unticked) and copy them to the same person's current list for that occasion, created if needed (Christmas: Dec 25; birthday: next same day). No claims are copied, gifts already there by name are skipped, the old list is unchanged. Owner only because it may create a list in their name; co-managers can still bring gifts forward from the current list.

## 2026-11-21 · Account name and year links

- **Account page** (`/account`, header link "Account"): your display name, your email, Sign out. The header no longer shows the email or Sign out directly.
- **Gyfte uses your account name**, never a guess from your email. Your first list "for me" sets the account name if you hadn't.
- **Year links on a list** ("‹ 2024 · 2026 ›"): the same person's lists for the same occasion, only those you can open.

## 2026-11-21 · Gyfte safety fixes and next steps (Hudson, after ChatGPT notes WRB-20261121-02 and -03)

- **Removing a person moves the Gyfte lists they manage to the admin removing them** (theirs and their kids'), instead of deleting them. Lists that were for them keep the name but lose the account link. Gifts they claimed become unclaimed. The confirmation spells out both counts first.
- **My claims freezes** once a list stops being shared with you: only the name you saw when claiming, no link, no later edits; you can Clear it.
- **A list shared with you opens Gyfte** even without Gyfte app access (the launcher shows Gyfte, the list opens, claiming works). App access is only needed to make your own lists and imports. Matches the access rule that item grants work on their own.
- **Kids (approved direction, not built yet):** each child is their own person in Gyfte with their own lists and year-by-year history, managed by one or more parents, no account needed. Gifts for siblings together live on a joint list so they can be claimed once; each child's page links to it. The import review assigns rows from a joint tab to one child, both (joint list) or skip. Parents see claims; the child never would once they have an account.
- **Order:** safety fixes, then account display name and a per-person year navigator, then kids (and connecting imported name-only lists to people), then the real import, then photos (upload or image link), then automatic link previews.
- Link names also read the product from the query when the path has none (`/product?id=fm-1` -> "FM 1").

## 2026-11-21 · Gyfte spreadsheet import (PR C)

- **Two steps:** upload an .xlsx (Google Sheets: File, Download, Microsoft Excel) into a private draft (`gyfte_imports`, owner only, one open draft per person), review, then Import. The file isn't kept; the source sheet is never changed.
- **Reader** (`src/lib/gyfte/sheet-import.ts`): one Christmas list per tab per year. Handles links behind "Here" / "Link 1" / product titles, ditto and "or" rows merged into the gift above, X marks and strikethrough as Got it, a price in the first column, sizes Google turned into dates, rows before any year heading (newest year assumed), and headings ("Clothes", ALL-CAPS lines) as unticked rows. Every guess is shown as a note on the row.
- **Applying:** lists are owned by the importer and private; the tab picked as "me" is marked as theirs. Lists that already exist (same person and Christmas) are skipped, so importing twice can't duplicate. Received gifts become Got it on that Christmas.
- **Later:** connect an imported list (e.g. "Molly") to that person's account when they join, so they own their own history.
- Tests use a made-up spreadsheet with the same quirks; no family data in the repo (earlier tests' real links and gift names replaced with fictional ones).
- `exceljs` reads the file; its old `uuid` dependency is overridden to a fixed version (audit stays at zero).

## 2026-11-21 · Gyfte bulk add (Hudson: "pretty generous import rules")

- **"Add several at once"** under the Add box: paste many gifts, see a live preview, untick anything that isn't a gift, then "Add N gifts". They go on top in paste order.
- **Generous parsing** (`src/lib/gyfte/bulk.ts`, pure, shared by preview and server): one gift per line; bullets, numbers and checkboxes stripped; links anywhere on a line (the rest is the name, a bare link is named from its address); prices ("$40", "under $30"), sizes ("size L") and colors ("color: navy") pulled out; spreadsheet rows read in the family sheet's column order; header rows, year lines and exact repeats skipped; up to 100 per paste.
- **Likely headings** (short un-bulleted lines with no link or details in a mostly bulleted paste, like "Clothes") start unticked.
- The server re-parses the pasted text itself and only uses the preview's unticked positions; it never trusts parsed gifts from the browser.
- The same parser will read the 2020-2025 sheet in the import (PR C).

## 2026-11-21 · Gyfte sharing and claims (PR B)

- **Two sharing levels on a list:** "See and claim" (contribute; groups and people) and "Can edit" (manage; people only, e.g. a partner or other parent).
- **Who you can share with:** your own groups and the people in them (admins: everyone). Nobody discovers who else is on warbag through sharing.
- **Claims live in `gyfte_claims`**, one active claim per item by a unique index (a race has one winner; the other sees "Someone just claimed this"). A deleted item keeps the claim as "removed" for the claimer until they clear it.
- **The recipient check is server-side in `getList`:** claim rows are only read for viewers allowed to see them, so the recipient's page carries no claim data at all. Tests break the rule on purpose to prove they catch it.
- **Share links** are view-only and show only wanted gifts (no received items, no claims) at `/g/<token>`.
- **The one-tap suggestion** copies the owner's most recent shared list's sharing, only when tapped.

## 2026-11-21 · Gyfte rules (Hudson, after ChatGPT review WRB-20261120-02)

1. **One list per person per occasion** ("Christmas 2026", "Birthday 2027"); past occasions live under History. Lists never need closing.
2. **Adding is one box** (paste a link or type a name); size, color, notes, price and extra links sit under "More". Links are cleaned of tracking junk and shown by store name.
3. **A new list can bring forward** the last list's unreceived items (never its claims), each easy to untick.
4. **Claims** default to Anonymous (Off and Named stay available per list). One active claimer per item, claimed atomically; only the claimer can undo.
5. **Who sees claims:** everyone with access to a list except the person it's for. That covers parents on kids' lists and a partner helping manage a list. Each list records who it's for: an account, or just a name (kids). Connecting a name to an account later hides claims from them from then on. Enforced in Gyfte's server code on every read, on top of the shared access rules.
6. **The person a list is for sees no claim signals at all:** no counts, no locked items (they can edit or delete anything), nothing in history or emails. If they delete a claimed item, the claimer sees "removed" in My claims.
7. **Share links to a Gyfte list show no claim information;** claiming requires signing in.
8. **Dates:** Christmas lists are dated December 25. Birthday lists ask for the date once and suggest it for that person's next birthday list. A list moves to History two weeks after its date.
9. **Sharing a new list** suggests the previous list's people and groups as a confirmation line (Share / Change); sharing never expands silently.
10. **Import** goes into a private draft Hudson reviews (merged duplicates, unusual rows, X and strikethrough read as received). The source sheet is never changed. Imported lists for people without accounts are owned by Hudson until those lists are connected to their accounts.
11. **Deferred:** hidden ideas added by others, extra fields, categories, approval steps.

Build order: PR A lists and items, PR B sharing and claims, PR C import and history.

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
