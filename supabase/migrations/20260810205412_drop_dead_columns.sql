-- Drop six columns confirmed dead by the 2026-08-10 audit. Approved by the owner.
--
-- DESTRUCTIVE and one-way. Each was verified before writing this migration:
--   * no reference anywhere under src/ (word-boundary grep across every .ts/.tsx)
--   * zero rows with a non-null value in production
-- The four hubspot_* columns are leftovers from the pre-platform HubSpot era.
-- ai_draft_reply and response_due_by were scaffolded for features never built.

alter table engagements    drop column if exists hubspot_company_id;
alter table engagements    drop column if exists hubspot_deal_id;
alter table contacts       drop column if exists hubspot_contact_id;
alter table communications drop column if exists hubspot_email_id;
alter table communications drop column if exists ai_draft_reply;
alter table communications drop column if exists response_due_by;
