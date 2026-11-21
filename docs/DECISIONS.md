# Decisions

Durable decisions, newest first. Each one says what was decided and why. When a decision changes, add a new entry and mark the old one superseded rather than editing history.

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
