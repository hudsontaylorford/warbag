-- Jot: sticky notes (the old Stickies app, rebuilt). One row per note.
-- Notes are private to their owner. A note in the Trash has trashed_at
-- set and is deleted for good 30 days later (or when the owner empties the
-- Trash). Board order is `position`, smallest first.
--
-- Reminders: remind_at is when; remind_by is how. 'email' goes to the
-- owner's account email; 'none' only shows on the note. 'text' is kept for
-- texting later (Hudson, 2026-11-25) and isn't offered yet. reminded_at is
-- set once the reminder has gone out, so it's sent once.

create table jot_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references "user" ("id") on delete cascade,
  body text not null default '' check (length(body) <= 20000),
  colour text not null default 'yellow'
    check (colour in ('yellow', 'pink', 'blue', 'green', 'orange', 'lilac')),
  importance text not null default 'none'
    check (importance in ('none', 'important', 'urgent', 'later')),
  remind_at timestamptz,
  remind_by text not null default 'email' check (remind_by in ('none', 'email', 'text')),
  reminded_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trashed_at timestamptz
);
create index jot_notes_owner_idx on jot_notes (owner_id, trashed_at, position);
create index jot_notes_due_idx on jot_notes (remind_at) where reminded_at is null and trashed_at is null;
