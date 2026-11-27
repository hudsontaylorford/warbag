-- Mosey: trip links people can join from, like chirk. The owner turns it on
-- per trip. Someone with the link picks their name; they get a guest account
-- (no email, no sign-in by code) that is a member of that trip only, and a
-- private link of their own to come back on another device. Money is a
-- separate switch, off by default. Receipt photos always need a real sign-in.

-- Guests: accounts made by joining a trip link. Never listed in People or
-- sharing pickers, never emailed (their address is a made-up .invalid one).
alter table "user" add column "isGuest" boolean not null default false;

alter table mosey_trips add column link_join boolean not null default false;
alter table mosey_trips add column link_money boolean not null default false;

-- A guest's own link for one trip. Turned off by the owner, or when the
-- guest is removed from the trip.
create table mosey_guest_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{32}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index mosey_guest_links_one_active on mosey_guest_links (trip_id, user_id) where revoked_at is null;
create index mosey_guest_links_trip_idx on mosey_guest_links (trip_id, created_at);
