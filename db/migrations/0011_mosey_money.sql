-- Mosey money: the people on a trip (named, optionally linked to an
-- account), households (couples who settle as one), expenses with who they're
-- split with, payments already made between people, how the trip settles,
-- frozen statements, and a log of every change. Money is whole cents.
-- Only trip members (contribute or manage) can read any of it; view links
-- and view grants never can (checked in code).

create table mosey_households (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80)
);

create table mosey_people (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  user_id text references "user" ("id") on delete set null,
  household_id uuid references mosey_households (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index mosey_people_one_account on mosey_people (trip_id, user_id) where user_id is not null;
create index mosey_people_trip_idx on mosey_people (trip_id, position);

create table mosey_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  description text not null check (length(btrim(description)) between 1 and 200),
  spent_on date not null,
  total_cents bigint not null check (total_cents > 0 and total_cents <= 100000000),
  paid_by uuid not null references mosey_people (id),
  notes text not null default '' check (length(notes) <= 1000),
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deleted expenses are kept for the log, never counted.
  deleted_at timestamptz
);
create index mosey_expenses_trip_idx on mosey_expenses (trip_id, spent_on, created_at) where deleted_at is null;

create table mosey_expense_people (
  expense_id uuid not null references mosey_expenses (id) on delete cascade,
  person_id uuid not null references mosey_people (id),
  primary key (expense_id, person_id)
);

-- Money one person already gave another: a share paid up front, or a
-- settle-up payment once it's sent.
create table mosey_payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  from_person uuid not null references mosey_people (id),
  to_person uuid not null references mosey_people (id),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000),
  paid_on date not null,
  note text not null default '' check (length(note) <= 200),
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_person <> to_person)
);
create index mosey_payments_trip_idx on mosey_payments (trip_id) where deleted_at is null;

create table mosey_settle (
  trip_id uuid primary key references mosey_trips (id) on delete cascade,
  mode text not null default 'direct' check (mode in ('direct', 'through')),
  -- A household id or a person id (for someone on their own).
  hub text
);

-- A settle-up frozen and shared. Never changed afterwards; later edits make a new version.
create table mosey_statements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  version integer not null,
  body jsonb not null,
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, version)
);

-- Every change to people, households, expenses and payments: who, when, before and after.
create table mosey_money_log (
  id bigint generated always as identity primary key,
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  actor_id text references "user" ("id") on delete set null,
  action text not null,
  target_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index mosey_money_log_trip_idx on mosey_money_log (trip_id, at desc);
