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

-- contact_id is an optional attribution on comms — deleting a contact should
-- unlink it from their comm history, not block the delete with a FK violation.
alter table comms drop constraint if exists comms_contact_id_fkey;
alter table comms add constraint comms_contact_id_fkey
  foreign key (contact_id) references contacts(id) on delete set null;
