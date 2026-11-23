-- Mosey: kids are on the trip (plan, who's going) but not in money splits
-- unless someone ticks them in for an expense, and then only through their
-- household. Kids never pay or get paid. Existing expenses are untouched.
alter table mosey_people add column kid boolean not null default false;
