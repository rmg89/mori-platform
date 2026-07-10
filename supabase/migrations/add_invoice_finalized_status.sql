-- ============================================================
-- Mori Platform — Migration: 'finalized' invoice status
-- Run this in Supabase SQL Editor
-- ============================================================

alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check check (status in ('draft','finalized','sent','paid'));
alter table invoices add column if not exists finalized_at timestamptz;

-- Mirror columns on engagements, matching the existing invoice_sent_at / deposit_invoice_sent_at pattern
alter table engagements add column if not exists invoice_finalized_at timestamptz;
alter table engagements add column if not exists deposit_finalized_at timestamptz;
