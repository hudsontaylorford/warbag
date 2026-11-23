-- Mosey: attendance is asked only on the stops that need it (split, limited
-- or optional plans); every other stop is everyone. Stops someone already
-- marked keep showing it.
alter table mosey_stops add column ask_attendance boolean not null default false;
update mosey_stops s set ask_attendance = true where exists (select 1 from mosey_attendance a where a.stop_id = s.id);
