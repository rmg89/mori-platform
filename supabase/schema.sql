-- ============================================================
-- Mori Taheripour Platform — Supabase Schema
-- Run this in your Supabase SQL editor to set up the database
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Clients ────────────────────────────────────────────────
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Contact
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  title text,
  organization text not null,

  -- Engagement
  stage text not null default 'new_inquiry'
    check (stage in ('new_inquiry','engaged','contract_sent','confirmed','briefing_ready','event_complete','invoiced','archived')),
  event_name text,
  event_date date,
  event_location text,
  event_city text,
  event_format text check (event_format in ('in_person','virtual','hybrid')),
  audience_size integer,
  topic text,
  session_length integer,
  fee numeric(10,2),
  travel_covered boolean default false,
  hotel_covered boolean default false,

  -- AV / Logistics
  av_needs text,
  special_requirements text,

  -- Internal
  notes text,
  booker_name text,
  source text,

  -- Document status
  contract_generated boolean default false,
  contract_signed boolean default false,
  advance_sheet_generated boolean default false,
  invoice_generated boolean default false,
  invoice_paid boolean default false
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger clients_updated_at before update on clients
  for each row execute function update_updated_at();

-- ─── Documents ───────────────────────────────────────────────
create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  type text not null check (type in ('contract','advance_sheet','invoice')),
  generated_at timestamptz default now(),
  file_url text,
  version integer default 1,
  invoice_number text
);

-- ─── Email threads (CRM) ─────────────────────────────────────
-- TODO: These will be populated by Microsoft Graph API sync
create table if not exists email_threads (
  id text primary key, -- Microsoft thread ID
  client_id uuid references clients(id),
  contact_name text,
  contact_email text,
  organization text,
  subject text,
  last_message_at timestamptz,
  message_count integer default 1,
  is_read boolean default false
);

create table if not exists email_messages (
  id text primary key, -- Microsoft message ID
  thread_id text references email_threads(id) on delete cascade,
  from_name text,
  from_email text,
  to_email text,
  subject text,
  body text,
  sent_at timestamptz,
  is_inbound boolean default true,
  ai_draft_reply text
);

-- ─── RLS Policies ────────────────────────────────────────────
-- Enable Row Level Security
alter table clients enable row level security;
alter table documents enable row level security;
alter table email_threads enable row level security;
alter table email_messages enable row level security;

-- For now, allow all authenticated users full access (role-based access can be added later)
create policy "Authenticated users can read clients" on clients
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert clients" on clients
  for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update clients" on clients
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read documents" on documents
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users can read emails" on email_threads
  for all using (auth.role() = 'authenticated');
create policy "Authenticated users can read messages" on email_messages
  for all using (auth.role() = 'authenticated');

-- ─── Storage bucket ──────────────────────────────────────────
-- Run this in Supabase dashboard > Storage or via API:
-- Create a bucket named "documents" (private)
-- Create a bucket named "media" (private)
