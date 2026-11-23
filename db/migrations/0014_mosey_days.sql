-- Mosey: an optional area ("Brooklyn", "Brooklyn → Hillsdale") and a light
-- tag ("Travel day") for each day of a trip. Days themselves come from the
-- trip's dates; a row exists only when a day has something set.
create table mosey_days (
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  day date not null,
  area text not null default '' check (char_length(area) <= 80),
  tag text not null default '' check (char_length(tag) <= 40),
  updated_at timestamptz not null default now(),
  primary key (trip_id, day)
);
