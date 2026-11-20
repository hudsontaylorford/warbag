-- Access model: groups, app access, per-item grants, share links, activity.
-- Rules live in src/lib/access; every check happens on the server.
-- Items belong to apps (their own tables). Here an item is named by
-- (app, item_type, item_id); the app supplies the owner.

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups (id) on delete cascade,
  user_id text not null references "user" ("id") on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on group_members (user_id);

-- Who can open an app and make their own items in it. Admins always can.
create table app_grants (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app ~ '^[a-z][a-z0-9-]{0,39}$'),
  user_id text references "user" ("id") on delete cascade,
  group_id uuid references groups (id) on delete cascade,
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (group_id is null))
);
create unique index app_grants_user_uq on app_grants (app, user_id) where user_id is not null;
create unique index app_grants_group_uq on app_grants (app, group_id) where group_id is not null;
create index app_grants_group_idx on app_grants (group_id);

-- One item shared with one person or group, at one level.
create table item_grants (
  id uuid primary key default gen_random_uuid(),
  app text not null check (app ~ '^[a-z][a-z0-9-]{0,39}$'),
  item_type text not null check (item_type ~ '^[a-z][a-z0-9-]{0,39}$'),
  item_id text not null check (length(item_id) between 1 and 100),
  user_id text references "user" ("id") on delete cascade,
  group_id uuid references groups (id) on delete cascade,
  role text not null check (role in ('view', 'contribute', 'manage')),
  created_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (group_id is null))
);
create unique index item_grants_user_uq on item_grants (app, item_type, item_id, user_id) where user_id is not null;
create unique index item_grants_group_uq on item_grants (app, item_type, item_id, group_id) where group_id is not null;
create index item_grants_item_idx on item_grants (app, item_type, item_id);
create index item_grants_user_idx on item_grants (user_id);
create index item_grants_group_idx on item_grants (group_id);

-- A link that opens one item without an account. Never grants manage.
-- Links die with the person who made them.
create table share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{32}$'),
  app text not null check (app ~ '^[a-z][a-z0-9-]{0,39}$'),
  item_type text not null check (item_type ~ '^[a-z][a-z0-9-]{0,39}$'),
  item_id text not null check (length(item_id) between 1 and 100),
  role text not null default 'view' check (role in ('view', 'contribute')),
  created_by text not null references "user" ("id") on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);
create index share_links_item_idx on share_links (app, item_type, item_id);

-- Who changed access to what, and when.
create table audit_events (
  id bigint generated always as identity primary key,
  actor_id text references "user" ("id") on delete set null,
  action text not null,
  target text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on audit_events (created_at desc);
