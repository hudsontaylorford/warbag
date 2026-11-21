-- Gyfte imports: a spreadsheet read into a private draft that its owner
-- reviews before anything becomes a list. The draft holds the parsed rows
-- (src/lib/gyfte/sheet-import.ts); the source file itself is not kept.

create table gyfte_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references "user" ("id") on delete cascade,
  file_name text not null default '' check (length(file_name) <= 200),
  data jsonb not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index gyfte_imports_owner_idx on gyfte_imports (owner_id, created_at desc);
