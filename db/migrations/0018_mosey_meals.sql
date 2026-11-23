-- Mosey: a stop or idea can be a meal (breakfast, lunch, dinner, or other
-- food and drink), with an optional note on who's handling it. Budgets,
-- shopping lists and assignments are later opt-ins, not here.
alter table mosey_stops add column meal text check (meal in ('breakfast', 'lunch', 'dinner', 'food'));
alter table mosey_stops add column handled_by text not null default '' check (char_length(handled_by) <= 200);
