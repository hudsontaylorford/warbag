-- Mosey: untimed stops can be placed anywhere in a day. sort_at is the time
-- an untimed stop sits at (the stop it was moved next to); ties between
-- stops at the same time follow position. Times still set the order.
alter table mosey_stops add column sort_at time;
