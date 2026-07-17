-- Temporary diagnostic: check whether rowsecurity is actually set on the
-- tables, since anon still reads all rows despite bypassrls being false.
create or replace function diagnose_rls_state_2()
returns table(tablename text, rowsecurity boolean, tableowner text) as $$
  select c.relname, c.relrowsecurity, pg_get_userbyid(c.relowner)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
$$ language sql security definer;

grant execute on function diagnose_rls_state_2 to anon;
