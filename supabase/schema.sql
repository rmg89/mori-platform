-- ============================================================
-- Mori Taheripour Platform — Supabase Schema v2
-- Drop existing tables and re-run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Drop existing tables (clean slate) ──────────────────────
drop table if exists email_messages   cascade;
drop table if exists email_threads    cascade;
drop table if exists documents        cascade;
drop table if exists comms            cascade;
drop table if exists contacts         cascade;
drop table if exists engagements      cascade;
drop table if exists companies        cascade;

-- ─── Auto-update helper ──────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;


-- ============================================================
-- COMPANIES
-- One row per organization. Referenced by engagements + contacts.
-- Mirrors the Companies tab in the Google Sheet.
-- ============================================================
create table companies (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),

  name         text not null unique,
  industry     text,
  website      text,
  watching     boolean default false,   -- "Priority / Watching?" in sheet
  notes        text
);

create trigger companies_updated_at before update on companies
  for each row execute function update_updated_at();


-- ============================================================
-- ENGAGEMENTS
-- One row per speaking engagement, prospect, or post-event record.
-- Section field determines which tab it lives in: prospects / engagements / wrap-up
-- ============================================================
create table engagements (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  last_activity_at    timestamptz default now(),

  -- ── Section & Stage ──────────────────────────────────────
  section             text not null
    check (section in ('prospects','engagements','wrap-up')),

  -- Prospect pipeline step (used when section = 'prospects')
  prospect_step       text
    check (prospect_step in ('inquiry','outreach','in_contact','confirmed','declined')),

  -- ── Core identity ────────────────────────────────────────
  organization        text not null,
  company_id          uuid references companies(id),
  event_name          text,
  event_type          text default 'speaking'
    check (event_type in ('speaking','podcast','interview','panel','livestream','coaching')),
  source              text,
  booker_name         text,

  -- ── Event details ────────────────────────────────────────
  event_date          date,
  event_time          text,             -- freeform: "10am", "1:45pm–3:30pm"
  event_location      text,
  event_city          text,
  event_format        text
    check (event_format in ('in_person','virtual','hybrid')),
  audience_size       integer,
  topic               text,
  session_length      integer,          -- minutes
  fee                 numeric(10,2),
  travel_covered      boolean default false,
  travel_destination  text,             -- e.g. "Yes, Miami"
  hotel_covered       boolean default false,
  av_needs            text,
  special_requirements text,

  -- Proposed dates (prospects) stored as JSONB:
  -- [{ "date": "2026-07-14", "times": ["10–11am EST"] }]
  proposed_dates      jsonb default '[]',

  -- ── Engagement progress ───────────────────────────────────
  contract_required   boolean,
  contract_sent_at    timestamptz,
  contract_signed_at  timestamptz,

  outgoing_materials  jsonb default '[]',
  outgoing_not_needed boolean default false,

  incoming_materials  jsonb default '[]',
  incoming_not_needed boolean default false,

  briefing_complete    boolean default false,
  briefing_complete_at timestamptz,
  briefing_notes       jsonb default '[]',

  -- ── Post-event / Wrap-up flags ────────────────────────────
  post_event_flags         text[] default '{}',
  post_event_needed        text[] default '{}',
  post_event_not_needed    text[] default '{}',
  post_event_follow_up_details text,
  post_event_notes         text,
  invoice_sent_at          timestamptz,

  -- ── Deposit invoice ───────────────────────────────────────
  deposit_amount           numeric(10,2),
  deposit_invoice_sent_at  timestamptz,
  deposit_received_at      timestamptz,

  -- ── Last contact (mirrors sheet) ─────────────────────────
  last_contact_date   date,
  last_contact_notes  text,

  -- ── Logistics / briefing fields ───────────────────────────
  join_link                text,
  dial_in_backup           text,
  green_room_time          text,
  go_live_time             text,
  arrival_time             text,
  venue_maps_link          text,
  venue_special_instructions text,

  flight_details           text,
  flight_confirmation      text,
  hotel_name               text,
  hotel_checkin            text,
  hotel_confirmation       text,
  hotel_maps_link          text,
  ground_transport         text,
  drive_time               text,
  drive_route_link         text,
  parking_details          text,

  run_of_show              jsonb default '[]',
  purpose                  text,
  audience_description     text,
  moderator_info           text,
  panelist_info            text,
  vip_info                 text,
  dress_code               text,

  -- ── AI / system fields ───────────────────────────────────
  ai_created               boolean default false,
  human_confirmed          boolean default false,
  confirmed_at             timestamptz,
  declined_at              timestamptz,

  notes                    text,
  media_links              text
);

create trigger engagements_updated_at before update on engagements
  for each row execute function update_updated_at();


-- ============================================================
-- CONTACTS
-- Many contacts per engagement. Also standalone (Contacts tab).
-- ============================================================
create table contacts (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  engagement_id   uuid references engagements(id) on delete cascade,
  company_id      uuid references companies(id),

  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  title           text,

  role            text default 'primary'
    check (role in ('primary','bureau','legal','logistics','av','assistant','other','unknown')),
  is_current_point_of_contact boolean default false,

  status          text default 'prospect_active'
    check (status in ('prospect_active','prospect_expired','client')),
  watching        boolean default false,

  notes           text
);

create trigger contacts_updated_at before update on contacts
  for each row execute function update_updated_at();


-- ============================================================
-- COMMS
-- Activity log per engagement: emails, calls, notes, stage changes.
-- ============================================================
create table comms (
  id              uuid primary key default uuid_generate_v4(),
  engagement_id   uuid references engagements(id) on delete cascade,
  contact_id      uuid references contacts(id),

  type            text not null
    check (type in ('email_inbound','email_outbound','note','stage_change','document_sent','call','other_channel')),
  date            timestamptz default now(),
  subject         text,
  body            text,
  from_name       text,
  to_name         text,
  staff_name      text,
  channel         text,
  needs_response  boolean default false,
  response_due_by timestamptz,
  tagged_manually boolean default false,
  ai_draft_reply  text
);


-- ============================================================
-- DOCUMENTS
-- ============================================================
create table documents (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  engagement_id   uuid references engagements(id) on delete cascade,

  type            text not null
    check (type in ('contract','briefing_doc','invoice')),
  generated_at    timestamptz default now(),
  file_url        text,
  version         integer default 1,
  invoice_number  text
);


-- ============================================================
-- EMAIL THREADS + MESSAGES
-- Future: populated by Microsoft Graph API sync.
-- ============================================================
create table email_threads (
  id                text primary key,
  engagement_id     uuid references engagements(id),
  contact_name      text,
  contact_email     text,
  organization      text,
  subject           text,
  last_message_at   timestamptz,
  message_count     integer default 1,
  is_read           boolean default false
);

create table email_messages (
  id              text primary key,
  thread_id       text references email_threads(id) on delete cascade,
  from_name       text,
  from_email      text,
  to_email        text,
  subject         text,
  body            text,
  sent_at         timestamptz,
  is_inbound      boolean default true,
  ai_draft_reply  text
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table companies       enable row level security;
alter table engagements     enable row level security;
alter table contacts        enable row level security;
alter table comms           enable row level security;
alter table documents       enable row level security;
alter table email_threads   enable row level security;
alter table email_messages  enable row level security;

create policy "Auth: companies all"       on companies     for all using (auth.role() = 'authenticated');
create policy "Auth: engagements select"  on engagements   for select using (auth.role() = 'authenticated');
create policy "Auth: engagements insert"  on engagements   for insert with check (auth.role() = 'authenticated');
create policy "Auth: engagements update"  on engagements   for update using (auth.role() = 'authenticated');
create policy "Auth: engagements delete"  on engagements   for delete using (auth.role() = 'authenticated');
create policy "Auth: contacts all"        on contacts      for all using (auth.role() = 'authenticated');
create policy "Auth: comms all"           on comms         for all using (auth.role() = 'authenticated');
create policy "Auth: documents all"       on documents     for all using (auth.role() = 'authenticated');
create policy "Auth: email_threads all"   on email_threads for all using (auth.role() = 'authenticated');
create policy "Auth: email_messages all"  on email_messages for all using (auth.role() = 'authenticated');


-- ============================================================
-- STORAGE BUCKETS
-- Create manually in Supabase Dashboard > Storage:
--   "documents" (private) — contracts, invoices, briefing docs
--   "media"     (private) — headshots, recordings, social assets
-- ============================================================