-- Never delete a Mosey trip because its organizer's account goes away:
-- account removal hands trips to the admin first (src/lib/people.ts), and
-- anything else that tries to delete that account is refused instead of
-- silently taking the trip, its plan and its money records with it.

alter table mosey_trips drop constraint mosey_trips_owner_id_fkey;
alter table mosey_trips add constraint mosey_trips_owner_id_fkey
  foreign key (owner_id) references "user" ("id") on delete restrict;
