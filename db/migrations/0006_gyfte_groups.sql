-- Gyfte groups: a page for a family or circle, with its people and each
-- year's lists. Membership is a regular warbag group (access_group_id), so
-- people are managed in one place; lists in a Gyfte group are shared with
-- that group. Only admins create groups (others will ask first).

create table gyfte_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  access_group_id uuid not null unique references groups (id) on delete cascade,
  is_sample boolean not null default false,
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now()
);

-- Which group a list belongs to (optional). Deleting a real group keeps its lists.
alter table gyfte_lists add column group_id uuid references gyfte_groups (id) on delete set null;
create index gyfte_lists_group_idx on gyfte_lists (group_id, occasion_date);

-- Made-up people in a sample group. They can't sign in, only admins can
-- "view as" them, and deleting the sample group deletes them.
create table sample_people (
  user_id text primary key references "user" ("id") on delete cascade,
  gyfte_group_id uuid not null references gyfte_groups (id) on delete cascade
);
