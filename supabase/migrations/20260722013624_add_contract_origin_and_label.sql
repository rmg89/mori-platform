-- Support multiple documents per engagement, distinguishing who created them:
-- 'drafted' (we generate and send it, the existing full flow) vs 'received'
-- (the client sent us theirs — an NDA, their own contract template, etc. —
-- which just needs to be uploaded and tracked, not generated).
alter table contracts add column if not exists origin text not null default 'drafted' check (origin in ('drafted', 'received'));
alter table contracts add column if not exists label text not null default 'Speaking Agreement';

-- A 'received' document has no fee and nothing to generate a PDF from.
alter table contracts alter column amount drop not null;
alter table contracts alter column snapshot set default '{}'::jsonb;

-- create_contract's signature changes (adds origin/label, amount/snapshot
-- become optional) -- Postgres can't CREATE OR REPLACE across a different
-- parameter list, so drop and recreate.
drop function if exists create_contract(uuid, text, numeric, jsonb);

create function create_contract(
  p_engagement_id uuid,
  p_organization text,
  p_amount numeric default null,
  p_snapshot jsonb default '{}'::jsonb,
  p_origin text default 'drafted',
  p_label text default 'Speaking Agreement'
) returns contracts language plpgsql as $$
declare
  v_seq integer;
  v_number text;
  v_row contracts;
begin
  v_seq := nextval('contract_number_seq');
  v_number := 'CON-' || lpad(v_seq::text, 4, '0');
  insert into contracts (engagement_id, contract_number, sequence_number, organization, amount, snapshot, origin, label)
  values (p_engagement_id, v_number, v_seq, p_organization, p_amount, p_snapshot, p_origin, p_label)
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function create_contract to anon, authenticated, service_role;
