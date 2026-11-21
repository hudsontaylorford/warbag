-- Gyfte claims: "I'll get this". One active claim per item, enforced here
-- so two people tapping at once can't both win. Claims are never shown to
-- the person a list is for (rule in src/lib/gyfte/claims.ts).
--
-- If the owner deletes a claimed item, the claim stays with item_id null so
-- the claimer can see it was removed. The name and list title are kept for
-- that message only.

create table gyfte_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references gyfte_items (id) on delete set null,
  list_id uuid references gyfte_lists (id) on delete set null,
  claimer_id text not null references "user" ("id") on delete cascade,
  item_name text not null,
  list_title text not null,
  created_at timestamptz not null default now()
);
create unique index gyfte_claims_item_uq on gyfte_claims (item_id) where item_id is not null;
create index gyfte_claims_claimer_idx on gyfte_claims (claimer_id, created_at desc);
