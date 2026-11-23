-- Mosey: a stop can be "morning", "afternoon", "evening" or "time TBD"
-- instead of an exact time. Neither set means any time.
alter table mosey_stops add column time_of_day text
  check (time_of_day in ('morning', 'afternoon', 'evening', 'tbd'));
alter table mosey_stops add constraint mosey_stops_one_when check (at_time is null or time_of_day is null);
