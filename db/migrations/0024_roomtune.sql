-- Room Tuner: one row per setup (a speaker in a room). The setup itself is
-- one JSON document (EQ layout, rounds of measurements, presets), checked
-- by src/lib/roomtune/setup.ts before it is stored. No audio is stored,
-- only 55 numbers per recording. Setups are private to their owner; a
-- view-only share link (app 'roomtune', type 'setup') shows one setup.

create table roomtune_setups (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references "user" ("id") on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  doc jsonb not null check (octet_length(doc::text) <= 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index roomtune_setups_owner_idx on roomtune_setups (owner_id, updated_at desc);
