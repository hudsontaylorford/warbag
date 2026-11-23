-- Receipt photos for Mosey expenses. The image lives in a private Vercel
-- Blob store; this row says who may see it (members of the trip, checked in
-- code) and what the AI suggested. Nothing reaches the ledger until a person
-- reviews the suggestion and saves the expense themselves.

create table mosey_receipts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references mosey_trips (id) on delete cascade,
  blob_path text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  -- sha-256 of the stored image, for "this receipt is already here".
  sha256 text not null,
  -- The AI's suggestion (merchant, date, total, description, confidence), or null.
  draft jsonb,
  draft_error text,
  expense_id uuid references mosey_expenses (id) on delete set null,
  uploaded_by text references "user" ("id") on delete set null,
  created_at timestamptz not null default now()
);
create index mosey_receipts_trip_idx on mosey_receipts (trip_id, created_at desc);
create index mosey_receipts_sha_idx on mosey_receipts (trip_id, sha256);
create index mosey_receipts_expense_idx on mosey_receipts (expense_id);
