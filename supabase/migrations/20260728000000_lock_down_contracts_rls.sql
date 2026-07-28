-- Bring `contracts` and `contract_templates` in line with the 2026-07-16
-- project-wide RLS lockdown (secure-supabase-rls). Both tables were created
-- afterward with the old "disable RLS + grant all to anon" pattern, which
-- regresses that work: the public anon key (shipped in the browser bundle)
-- could read and write every contract's client data (fees, contact names,
-- emails, phones, addresses) and rewrite the contract boilerplate directly,
-- bypassing the server-side gateway.
--
-- The whole app already reads/writes these tables through /api/* routes using
-- the service-role client (supabaseAdmin), which bypasses RLS, so enabling
-- default-deny RLS for anon changes nothing about how the app behaves. These
-- are brand-new tables (created after the abandoned-RLS-policy incident), so
-- there are no leftover policies to reactivate -- default-deny is genuine here.

-- contracts: sensitive client data, no anon access.
alter table contracts enable row level security;
revoke all on contracts from anon, authenticated;
grant all on contracts to service_role;

-- contract_templates: editable boilerplate, still served via the gateway.
alter table contract_templates enable row level security;
revoke all on contract_templates from anon, authenticated;
grant all on contract_templates to service_role;

-- The number sequence and the create_contract RPC are only ever driven by the
-- service-role gateway; drop their anon/authenticated grants too so nothing
-- reachable from the browser bundle can mint contract rows directly.
revoke usage, select on sequence contract_number_seq from anon, authenticated;
grant usage, select on sequence contract_number_seq to service_role;
revoke execute on function create_contract(uuid, text, numeric, jsonb, text, text, uuid) from anon, authenticated;
grant execute on function create_contract(uuid, text, numeric, jsonb, text, text, uuid) to service_role;
