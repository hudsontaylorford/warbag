-- Requests to join a Gyfte group, made from its family link by someone
-- who isn't on it yet. Nothing is created until an admin approves; a
-- declined request is deleted. One pending request per email per group.

create table gyfte_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references gyfte_groups (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  email text not null check (length(email) between 3 and 254),
  created_at timestamptz not null default now()
);
create unique index gyfte_join_requests_one_per_email on gyfte_join_requests (group_id, email);
create index gyfte_join_requests_group_idx on gyfte_join_requests (group_id, created_at desc);
