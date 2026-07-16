-- Coordinated cutover for the server-side gateway retrofit (see
-- 20260716183728_grant_service_role_all_tables.sql and the secure-supabase-rls
-- branch): every table read/write now goes through API routes using
-- supabaseAdmin() (service_role), which bypasses RLS entirely regardless of
-- policies. Enabling RLS here with zero CREATE POLICY statements is true
-- default-deny for anon/authenticated — the browser's anon key, previously
-- able to read/write every table directly, loses all access the moment this
-- lands. Deliberately not bundled into the gateway migration: prod/preview/
-- dev share one live Supabase project, so this could only run after the new
-- server-side code was already live (confirmed 2026-07-16).

alter table companies      enable row level security;
alter table engagements    enable row level security;
alter table contacts       enable row level security;
alter table communications enable row level security;
alter table calls          enable row level security;
alter table materials      enable row level security;
alter table briefing_notes enable row level security;
alter table invoices       enable row level security;
alter table business_profile enable row level security;
alter table review_items   enable row level security;
