create or replace function diagnose_existing_policies()
returns table(tablename text, policyname text, permissive text, roles text[], cmd text, qual text, with_check text) as $$
  select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname
$$ language sql security definer;

grant execute on function diagnose_existing_policies to anon;
