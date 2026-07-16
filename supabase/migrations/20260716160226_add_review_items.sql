-- ============================================================
-- Mori Platform — Migration: Review queue for inbound-email triage
-- ============================================================

create table if not exists review_items (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null,
  from_name text,
  from_email text not null,
  subject text,
  body_preview text,
  body text,
  account text,
  ai_confidence numeric,
  state text not null default 'needs_review' check (state in ('ai_sorted','needs_review')),
  ai_suggested_action text check (ai_suggested_action in ('create_prospect','add_to_existing','update_prospect','ignore')),
  ai_suggested_engagement_id uuid references engagements(id) on delete set null,
  ai_reasoning text,
  ai_extracted jsonb,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists review_items_confirmed_at_idx on review_items(confirmed_at);
create index if not exists review_items_from_email_idx on review_items(from_email);

-- Same "anon key, no per-user auth" pattern as every other table (20260625_features.sql)
alter table review_items disable row level security;
grant all on review_items to anon, authenticated;
