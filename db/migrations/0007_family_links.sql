-- Family links: one link per Gyfte group, for the family group chat.
-- Anyone with it sees the group's names and wanted gifts (never claims).
-- "This is me" emails that person a one-tap sign-in link; sends are
-- logged here so they can be limited.

alter table gyfte_groups add column invite_token text unique check (invite_token ~ '^[A-Za-z0-9_-]{32}$');

create table sign_in_link_sends (
  id bigint generated always as identity primary key,
  user_id text not null references "user" ("id") on delete cascade,
  group_id uuid references gyfte_groups (id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index sign_in_link_sends_user_idx on sign_in_link_sends (user_id, sent_at desc);
create index sign_in_link_sends_group_idx on sign_in_link_sends (group_id, sent_at desc);
