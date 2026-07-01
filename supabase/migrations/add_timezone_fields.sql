-- Add timezone tracking to calls and a per-engagement event timezone
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS scheduled_tz text;

ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS event_timezone    text,
  ADD COLUMN IF NOT EXISTS archived_reason   text;
