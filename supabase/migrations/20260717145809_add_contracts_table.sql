-- ============================================================
-- Mori Platform — Migration: Contracts table + sequential numbering
-- Mirrors the invoices table (20260710121451_add_invoices_table.sql)
-- ============================================================

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  engagement_id uuid references engagements(id) on delete set null,
  contract_number text not null unique,
  sequence_number integer not null,
  organization text not null,
  amount numeric(10,2) not null,
  status text not null default 'draft' check (status in ('draft','finalized','sent','signed')),
  finalized_at timestamptz,
  sent_at timestamptz,
  signed_at timestamptz,
  snapshot jsonb not null
);
create index if not exists contracts_engagement_id_idx on contracts(engagement_id);
create index if not exists contracts_status_idx on contracts(status);

-- Same "anon key, no per-user auth" pattern as every other table
alter table contracts disable row level security;
grant all on contracts to anon, authenticated;

create sequence if not exists contract_number_seq start 1;
grant usage, select on sequence contract_number_seq to anon, authenticated;

-- Atomic: assigns the next number and inserts in one transaction, no race window
create or replace function create_contract(
  p_engagement_id uuid, p_organization text, p_amount numeric, p_snapshot jsonb
) returns contracts language plpgsql as $$
declare
  v_seq integer;
  v_number text;
  v_row contracts;
begin
  v_seq := nextval('contract_number_seq');
  v_number := 'CON-' || lpad(v_seq::text, 4, '0');
  insert into contracts (engagement_id, contract_number, sequence_number, organization, amount, snapshot)
  values (p_engagement_id, v_number, v_seq, p_organization, p_amount, p_snapshot)
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function create_contract to anon, authenticated;

-- Mirrors invoice_finalized_at — contract_sent_at/contract_signed_at already exist on engagements
alter table engagements add column if not exists contract_finalized_at timestamptz;
