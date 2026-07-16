-- Temporary diagnostic: anon key still reads all rows from `engagements`
-- immediately after enabling RLS with zero policies, which should return
-- zero rows instead. Checking whether anon/authenticated have BYPASSRLS
-- (a role attribute independent of RLS/policies entirely) or table-level
-- ownership that would explain it. This function is dropped by the next
-- migration once the diagnosis is read.
create or replace function diagnose_rls_state()
returns table(rolename text, bypassrls boolean, is_superuser boolean) as $$
  select rolname, rolbypassrls, rolsuper
  from pg_roles
  where rolname in ('anon', 'authenticated', 'service_role', 'postgres')
$$ language sql security definer;

grant execute on function diagnose_rls_state to anon;
