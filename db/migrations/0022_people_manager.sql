-- People managers: non-admins (like an assistant's account) who can invite
-- people and manage groups and app access, but never their own access,
-- admins, removing people, deleting groups or making admins. Admins set it.
alter table "user" add column "isPeopleManager" boolean not null default false;
