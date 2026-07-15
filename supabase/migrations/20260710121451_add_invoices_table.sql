-- ============================================================
-- Mori Platform — Migration: Invoices table + sequential numbering
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  engagement_id uuid references engagements(id) on delete set null,
  type text not null check (type in ('invoice','deposit')),
  invoice_number text not null unique,
  sequence_number integer not null,
  organization text not null,
  amount numeric(10,2) not null,
  status text not null default 'draft' check (status in ('draft','sent','paid')),
  due_at timestamptz,
  sent_at timestamptz,
  paid_at timestamptz,
  snapshot jsonb not null
);
create index if not exists invoices_engagement_id_idx on invoices(engagement_id);
create index if not exists invoices_status_idx on invoices(status);

-- Same "anon key, no per-user auth" pattern as every other table (20260625_features.sql)
alter table invoices disable row level security;
grant all on invoices to anon, authenticated;

-- One shared sequence across both invoice types (INV-0041, DEP-0042, INV-0043, ...)
create sequence if not exists invoice_number_seq start 1;
grant usage, select on sequence invoice_number_seq to anon, authenticated;

-- Atomic: assigns the next number and inserts in one transaction, no race window
create or replace function create_invoice(
  p_engagement_id uuid, p_type text, p_organization text,
  p_amount numeric, p_due_at timestamptz, p_snapshot jsonb
) returns invoices language plpgsql as $$
declare
  v_seq integer;
  v_number text;
  v_row invoices;
begin
  v_seq := nextval('invoice_number_seq');
  v_number := (case when p_type = 'deposit' then 'DEP' else 'INV' end) || '-' || lpad(v_seq::text, 4, '0');
  insert into invoices (engagement_id, type, invoice_number, sequence_number, organization, amount, due_at, snapshot)
  values (p_engagement_id, p_type, v_number, v_seq, p_organization, p_amount, p_due_at, p_snapshot)
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function create_invoice to anon, authenticated;
