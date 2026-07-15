-- ============================================================
-- Mori Platform — Migration: business profile (invoice letterhead fields)
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists business_profile (
  id integer primary key default 1,
  name text not null default 'MT Global Strategies',
  address text,
  phone text,
  fax text,
  updated_at timestamptz default now()
);

insert into business_profile (id, name, address, phone, fax)
values (1, 'MT Global Strategies', '2425 L Street, NW, #409, Washington, DC', '510-385-7917', '202-223-1655')
on conflict (id) do nothing;

alter table business_profile disable row level security;
grant all on business_profile to anon, authenticated;
