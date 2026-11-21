-- Kids: people in Gyfte without accounts, each with one or more parents
-- who manage their lists. A list is for a kid (one row in gyfte_list_kids)
-- or for siblings together (a joint list: two or more rows), so a shared
-- gift exists once and can only be claimed once.

create table gyfte_kids (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now()
);

create table gyfte_kid_parents (
  kid_id uuid not null references gyfte_kids (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  added_at timestamptz not null default now(),
  primary key (kid_id, user_id)
);
create index gyfte_kid_parents_user_idx on gyfte_kid_parents (user_id);

create table gyfte_list_kids (
  list_id uuid not null references gyfte_lists (id) on delete cascade,
  kid_id uuid not null references gyfte_kids (id) on delete cascade,
  primary key (list_id, kid_id)
);
create index gyfte_list_kids_kid_idx on gyfte_list_kids (kid_id);
