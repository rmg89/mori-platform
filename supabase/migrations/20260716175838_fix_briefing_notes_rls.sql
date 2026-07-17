-- ─── Fix RLS: app uses anon key with no user auth ─────────────
-- briefing_notes was never covered by the earlier blanket RLS-disable
-- migration (20260625162739_features.sql), so anon-key inserts from the
-- browser fail with "new row violates row-level security policy".
-- The MCP server never hit this because it writes with the service-role
-- key, which bypasses RLS.
alter table briefing_notes disable row level security;
grant all on briefing_notes to anon, authenticated;
