create or replace function diagnose_current_role()
returns table(current_role_name text, session_user_name text, current_user_bypassrls boolean, engagements_policy_count bigint) as $$
  select
    current_user,
    session_user,
    (select rolbypassrls from pg_roles where rolname = current_user),
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'engagements')
$$ language sql security invoker;

grant execute on function diagnose_current_role to anon;
