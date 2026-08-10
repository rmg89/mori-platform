-- Fix the three schema gaps behind "nothing I enter is saving" (reported 2026-08-10).
-- All additive: widens one check constraint, adds two columns. No data is dropped
-- and no existing row can be rejected by the new constraint.

-- 1. communications.type rejected 'note' on the live table, even though schema.sql
--    has always listed it as valid. The UI's Log Activity panel offers Note / Call /
--    Email Sent, so every "Note" a user logged failed with a 400 while still showing
--    up in the timeline optimistically. Widen the live constraint to the set the app
--    (and schema.sql) actually use.
alter table communications drop constraint if exists communications_type_check;
alter table communications add constraint communications_type_check
  check (type in ('email_inbound','email_outbound','note','stage_change','document_sent','call','other_channel'));

-- 2. post_event_notes was written to local state and read back by three pages, but
--    no such column existed. The wrap-up page's handler wrote to `notes` instead,
--    which silently overwrote the engagement's general notes on every keystroke.
alter table engagements add column if not exists post_event_notes text;

-- 3. proposed_dates (the prospect date/time options) was pure local state — no column,
--    and no write path at all. Every proposed date vanished on refresh.
alter table engagements add column if not exists proposed_dates jsonb not null default '[]'::jsonb;
