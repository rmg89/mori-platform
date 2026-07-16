-- ============================================================
-- Mori Platform — Migration: grant service_role access to review_items
--
-- Every other API route backed by SUPABASE_SERVICE_ROLE_KEY works against
-- tables created before the CLI adopted migration tracking (2026-07-15),
-- when migrations were pasted into the SQL Editor as the `postgres`
-- superuser. Tables created via `supabase db push` are owned by the CLI's
-- own migration-runner role instead, so `service_role` doesn't inherit
-- default-privilege access the way it does for older tables — confirmed by
-- a live "permission denied for table review_items" from the ingest route.
-- ============================================================

grant all on review_items to service_role;
