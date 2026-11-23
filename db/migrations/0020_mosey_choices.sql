-- Mosey: competing options on a day ("Monday afternoon: ski, hike or spa").
-- A choice groups two or more stops on the same day; each person picks one
-- (their "going" mark moves between the options). Ungrouping keeps the
-- stops and the picks.
create table mosey_choices (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 80),
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now()
);
alter table mosey_stops add column choice_id uuid references mosey_choices (id) on delete set null;
create index mosey_stops_choice_idx on mosey_stops (choice_id);
