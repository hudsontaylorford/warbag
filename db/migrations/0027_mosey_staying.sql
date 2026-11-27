-- Mosey: an optional "Staying" line per day (where people sleep that night),
-- typed by an organizer, shown to members only and only when it changes from
-- the night before. Additive: existing rows get an empty value.
alter table mosey_days add column staying text not null default '' check (char_length(staying) <= 120);
