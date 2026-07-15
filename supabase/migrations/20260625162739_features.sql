-- ============================================================
-- Mori Platform — Migration: Next Steps, Snapshots, Field Statuses
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─── Fix RLS: app uses anon key with no user auth ─────────────
-- Without this, delete/insert operations from the browser fail silently
alter table engagements disable row level security;
alter table contacts       disable row level security;
alter table communications disable row level security;
alter table companies      disable row level security;

-- Grant anon + authenticated full access
grant all on engagements    to anon, authenticated;
grant all on contacts       to anon, authenticated;
grant all on communications to anon, authenticated;
grant all on companies      to anon, authenticated;

-- ─── Stage snapshots on engagements ──────────────────────────
-- prospect_snapshot: saved when prospect → engagement (stores prospect-stage data)
-- engagement_snapshot: saved when engagement → wrap-up (stores engagement-stage data)
alter table engagements
  add column if not exists prospect_snapshot   jsonb,
  add column if not exists engagement_snapshot jsonb;

-- ─── Field statuses ──────────────────────────────────────────
-- Tracks which blank fields are "needed" vs "not_needed" vs unknown (null)
-- e.g. { "fee": "needed", "event_city": "not_needed" }
alter table engagements
  add column if not exists field_statuses jsonb default '{}'::jsonb;

-- ─── Next step flags on communications ──────────────────────
-- Any timeline entry can carry a next-step with a due date + snooze
alter table communications
  add column if not exists next_step              text,
  add column if not exists next_step_due_at       timestamptz,
  add column if not exists next_step_snoozed_until timestamptz,
  add column if not exists next_step_cleared      boolean default false;

-- ─── Missing columns (code uses these but schema didn't have them) ────
alter table engagements
  add column if not exists archived              boolean default false,
  add column if not exists archived_at           timestamptz,
  add column if not exists cancellation_reason   text,
  add column if not exists post_event_stages     jsonb default '{}'::jsonb,
  add column if not exists post_event_item_notes jsonb default '{}'::jsonb,
  add column if not exists post_event_media      jsonb default '[]'::jsonb,
  add column if not exists post_event_testimonial_link text,
  add column if not exists post_event_testimonial_text text,
  add column if not exists post_event_follow_up_date   date,
  add column if not exists payment_notes         text,
  add column if not exists team_id               uuid,
  add column if not exists event_end_date        date,
  add column if not exists media_confirmed       boolean default false,
  add column if not exists media_bio_sent        boolean default false,
  add column if not exists media_prep_sent       boolean default false,
  add column if not exists media_day_of_ready    boolean default false;

-- contacts table may be missing team_id
alter table contacts
  add column if not exists team_id uuid;
