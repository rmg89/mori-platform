-- ============================================================
-- Mori Platform — Migration: allow deleting companies & contacts
-- Run this in Supabase SQL Editor
-- ============================================================

-- company_id is an optional link on engagements/contacts — deleting a company
-- should unlink it from those rows, not block the delete with a FK violation.
alter table engagements drop constraint if exists engagements_company_id_fkey;
alter table engagements add constraint engagements_company_id_fkey
  foreign key (company_id) references companies(id) on delete set null;

alter table contacts drop constraint if exists contacts_company_id_fkey;
alter table contacts add constraint contacts_company_id_fkey
  foreign key (company_id) references companies(id) on delete set null;

-- contact_id is an optional attribution on communications — deleting a contact
-- should unlink it from their comm history, not block the delete with a FK
-- violation. The table is named "communications" live (schema.sql still says
-- "comms" — that file is stale on this point, confirmed 2026-07-15).
alter table communications drop constraint if exists comms_contact_id_fkey;
alter table communications drop constraint if exists communications_contact_id_fkey;
alter table communications add constraint communications_contact_id_fkey
  foreign key (contact_id) references contacts(id) on delete set null;
