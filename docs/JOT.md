# Jot

Sticky notes. Write a note, give it a colour and a label (Important, Urgent, Later), set a reminder, and keep notes in your own order or grouped by label. Deleted notes wait in the Trash for 30 days.

Jot is the old **Stickies** app (lovewillwin, November 2026), rebuilt in warbag on 2026-11-25 and renamed by Hudson. The old app's handover pack is `stickies.zip` in Drive ("Warbag — Project Archive"). This file is Jot's README and roadmap; warbag's ROADMAP.md only points here.

## Where the code is

| File | What it is |
|---|---|
| `src/lib/jot/note.ts` | Shapes, `cleanFields` (the server's check on every save), the old Stickies file reader, bold/italic/link formatting. Pure; runs in the browser and tests. |
| `src/lib/jot/notes.ts` | Server: who may see, write, move, trash, restore, empty and import notes. |
| `src/lib/jot/reminders.ts` | Server: sends due reminders by email. |
| `src/app/api/jot/reminders/route.ts` | What the scheduler calls every few minutes (needs `CRON_SECRET`). |
| `.github/workflows/jot-reminders.yml` | The scheduler: a GitHub Actions schedule every 5 minutes (Hudson's choice, 2026-11-25). |
| `src/app/jot/` | The pages: `/jot` (notes), `/jot/new`, `/jot/[id]` (one note), `/jot/trash`. |
| `tests/unit/jot-note.test.ts`, `tests/db/jot.test.ts`, `e2e/jot.spec.ts` | Tests. |

## Who can use it

Anyone Hudson turns it on for (People → a person → Apps → **Jot**); admins always have it. Each note is private to its owner: admins don't see other people's notes, and there's no sharing yet. App access is checked on every read and save, and before each reminder email, so turning it off takes effect on the next request.

## Data

One row per note in `jot_notes`: text (up to 20,000 characters), colour (yellow, pink, blue, green, orange, lilac), label (`importance`: none, important, urgent, later), reminder time and how (`remind_by`), when the reminder went out (`reminded_at`), board position, and `trashed_at` for the Trash.

- **Order:** new and restored notes go on top. Reorder moves a note up or down (tap or keyboard, the same pattern as Mosey). "By label" only changes the view.
- **Trash:** a trashed note can't be edited until it's restored. Notes over 30 days old are deleted when the Trash is next opened; "Empty trash" (two taps) deletes the rest at once. Nothing else empties it.
- **Saving:** the note page saves a moment after typing stops, one save at a time, and says "Saved ✓" only after the server confirms. A new note isn't made until it has some text, so an abandoned New note leaves nothing behind.
- **Formatting:** the same notes format as the rest of warbag (blank line = paragraph, "- " = list), plus `**bold**`, `*italic*` (Cmd/Ctrl+B and +I in the note) and web links, which open in a new tab from the note page's text. On the board, a card is itself a link, so links show as underlined text.

## Reminders

- A note's reminder has a time (in the viewer's own time zone) and a **How**: **Email me** (to the account's email) or **Only show it on the note**. A due note turns red on the board either way.
- Sent once: a GitHub Actions schedule calls `/api/jot/reminders` every 5 minutes (GitHub often runs it a few minutes late, so an email can arrive up to about 20 minutes after the time); each due reminder is claimed, then emailed. A failed email is tried again on the next run. Changing the time means a new reminder; editing the text doesn't resend.
- Not sent: notes in the Trash, show-only reminders, reminders already past when set, imported or restored, and anything more than a day late (so a scheduler outage never brings a flood).
- **Texting (kept for later, Hudson 2026-11-25):** the old app texted the phone through lovewillwin's texting service, which warbag doesn't have. `remind_by` already allows `text`, so adding it later is a new sender and a choice in How, not a change to notes. Needs: a texting provider (e.g. Twilio), a verified phone number per person, and Hudson's go.

## Importing from Stickies

Jot → **Import from Stickies** → pick the old app's `data/notes.json` (or `data/trash.json`). Each note is added as a new one above what's there, in the old order, with its text, colour, label (old gold/red/green and true read as Important/Urgent/Later), reminder ("Text my phone" off becomes show-only), and created time. Trashed notes go to the Trash with their days left; ones deleted over 30 days ago are skipped. All or nothing; importing twice makes copies. Fonts, sizes, grid cells and kanban column names don't carry over. The real files weren't in the handover pack (personal data), so they come from the old box.

## What changed from Stickies, and why

- **Warbag's look** instead of the corkboard: pale colour tints on paper, ink text, no tape, tilt or handwriting fonts. Colours are tokens in `globals.css` (`--color-jot-*`), each passing AA with ink, soft and the link blue.
- **Editing on its own page** (tap a note) instead of in place on the board: one big text box on a phone, and the colour, label and reminder below it. Board cards stay readable.
- **Left out on purpose:** four fonts, three sizes / the 2x2 grid with free cells, Tidy up, kanban drag and editable column names. "By label" covers the kanban view. Any can come back if missed.
- **Buddy adding notes by text** isn't part of warbag. An assistant could add notes later through its own account (CLAUDE.md, assistant access) if Hudson wants it.

## Roadmap (each needs Hudson's go)

1. **Texting reminders** (see Reminders).
2. Snooze from the email (e.g. "in an hour", "tomorrow morning").
3. Share a note or a set of notes with a person or group (warbag's grants: view, contribute).
4. Search across notes.
5. Wide notes (a card across two columns) and drag to reorder on desktop.
6. Parked from Stickies: **notes that run an action at a time** ("email Rich and order 3 peony boxes Monday"). Anything that sends, spends or deletes would be drafted first and need a yes each time.
