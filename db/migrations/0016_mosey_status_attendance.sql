-- Mosey: a stop's status (none, tentative, inquiry sent, confirmed, booked)
-- and who's going to it, from the trip's people list. Attendance is for trip
-- members only (never view links), like money.
alter table mosey_stops add column status text
  check (status in ('tentative', 'asked', 'confirmed', 'booked'));

create table mosey_attendance (
  stop_id uuid not null references mosey_stops (id) on delete cascade,
  person_id uuid not null references mosey_people (id) on delete cascade,
  state text not null check (state in ('going', 'maybe')),
  updated_by text references "user" ("id") on delete set null,
  updated_at timestamptz not null default now(),
  primary key (stop_id, person_id)
);
create index mosey_attendance_person_idx on mosey_attendance (person_id);
