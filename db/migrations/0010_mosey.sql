-- Mosey: trip planning. A trip has a date range; its Plan is the stops on
-- each day, and its Ideas are stops with no day yet. Who can see or edit a
-- trip uses the shared access tables (item_grants, share_links) with
-- app 'mosey', type 'trip': manage = organizer, contribute = member,
-- view = viewer (and view-only links).

create table mosey_trips (
  id uuid primary key default gen_random_uuid(),
  -- The organizer who made it. Trips go with their owner.
  owner_id text not null references "user" ("id") on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  place text not null default '' check (length(place) <= 120),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 60)
);
create index mosey_trips_owner_idx on mosey_trips (owner_id, start_date desc);

create table mosey_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  -- On the plan for this day; null means it's an idea.
  day date,
  -- An idea someone suggested for a day, waiting for an organizer.
  suggested_day date,
  -- Local time on the trip, or null for "any time". No time zones: a trip's
  -- times are wall-clock times where the trip is.
  at_time time,
  title text not null check (length(btrim(title)) between 1 and 200),
  place text not null default '' check (length(place) <= 200),
  link text not null default '' check (length(link) <= 2000),
  notes text not null default '' check (length(notes) <= 2000),
  -- Hidden from view-only links (e.g. the rental's address).
  members_only boolean not null default false,
  position integer not null default 0,
  created_by text references "user" ("id") on delete set null,
  -- Who put it on the plan (organizers only).
  planned_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (day is null or suggested_day is null)
);
create index mosey_stops_trip_idx on mosey_stops (trip_id, day, at_time, position);
