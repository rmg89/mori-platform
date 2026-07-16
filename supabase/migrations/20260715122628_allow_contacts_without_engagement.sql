-- ============================================================
-- Mori Platform — Migration: allow contacts with no engagement
-- Run this in Supabase SQL Editor
-- ============================================================

-- Standalone "Add Contact" (Contacts directory) creates a contact with no
-- parent engagement. schema.sql shows engagement_id as nullable, but the live
-- table still has a not-null constraint (confirmed by a direct insert test on
-- 2026-07-15, which failed with "null value in column engagement_id violates
-- not-null constraint") — this migration brings the live table in line with
-- what the app has always assumed schema.sql already allowed.
alter table contacts alter column engagement_id drop not null;
