-- ============================================================
-- Mori Platform — Migration: add missing confirmed_at/declined_at
-- Run this in Supabase SQL Editor
-- ============================================================

-- These are base schema.sql columns (engagements table, "AI / system fields"
-- section) that the app has always written to (confirmProspect / declineProspect
-- in src/lib/store.tsx, and the move_to_confirmed / update_prospect_stage MCP
-- tools) but that appear to be missing from the live table — PostgREST returns
-- "Could not find the 'confirmed_at' column of 'engagements' in the schema cache"
-- when confirming a prospect.
alter table engagements add column if not exists confirmed_at timestamptz;
alter table engagements add column if not exists declined_at timestamptz;
