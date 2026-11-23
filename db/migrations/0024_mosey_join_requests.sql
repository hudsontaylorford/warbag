-- Mosey: asking to join a trip from its trip link. Nothing is created until
-- the trip's owner adds them; declining deletes the request. One pending
-- request per email per trip.
create table mosey_join_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  email text not null check (length(email) between 3 and 254),
  created_at timestamptz not null default now()
);
create unique index mosey_join_requests_one_per_email on mosey_join_requests (trip_id, email);
create index mosey_join_requests_trip_idx on mosey_join_requests (trip_id, created_at);
