-- Gyfte: gift lists. One list per person per occasion.
-- Access goes through src/lib/access (app 'gyfte', item type 'list').
-- Claims arrive in a later migration.

create table gyfte_lists (
  id uuid primary key default gen_random_uuid(),
  -- Who manages the list (a parent for a kid's list). Lists go with their owner.
  owner_id text not null references "user" ("id") on delete cascade,
  -- Who the list is for: an account, or just a name (kids). Claims are
  -- never shown to recipient_user_id.
  recipient_user_id text references "user" ("id") on delete set null,
  recipient_name text not null check (length(btrim(recipient_name)) between 1 and 80),
  occasion text not null check (occasion in ('christmas', 'birthday')),
  occasion_date date not null,
  claims_mode text not null default 'anonymous' check (claims_mode in ('off', 'named', 'anonymous')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gyfte_lists_owner_idx on gyfte_lists (owner_id, occasion_date desc);
create index gyfte_lists_recipient_idx on gyfte_lists (recipient_user_id);

create table gyfte_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references gyfte_lists (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  notes text not null default '' check (length(notes) <= 1000),
  size text not null default '' check (length(size) <= 80),
  color text not null default '' check (length(color) <= 80),
  price text not null default '' check (length(price) <= 40),
  links text[] not null default '{}' check (cardinality(links) <= 5),
  starred boolean not null default false,
  -- Lower comes first. New items get a lower number, so they sit on top.
  position double precision not null,
  received_at timestamptz,
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gyfte_items_list_idx on gyfte_items (list_id, position);
