-- Server-side gateway migration is switching every table read/write from the
-- anon client to supabaseAdmin() (service_role). Discovered live that
-- `invoices` was missing a service_role grant (only `anon, authenticated`
-- were granted in 20260710121451_add_invoices_table.sql), causing
-- "permission denied for table invoices" even though service_role is meant
-- to bypass RLS entirely. Granting explicitly + via default privileges so no
-- current or future table hits the same gap.

grant all on companies      to service_role;
grant all on engagements    to service_role;
grant all on contacts       to service_role;
grant all on communications to service_role;
grant all on calls          to service_role;
grant all on materials      to service_role;
grant all on briefing_notes to service_role;
grant all on invoices       to service_role;
grant all on business_profile to service_role;
grant all on review_items   to service_role;

grant usage, select on sequence invoice_number_seq to service_role;
grant execute on function create_invoice to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
