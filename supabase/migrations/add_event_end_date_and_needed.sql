ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS event_end_date date,
  ADD COLUMN IF NOT EXISTS needed text[] DEFAULT '{}';
