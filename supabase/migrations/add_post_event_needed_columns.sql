ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS post_event_needed text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS post_event_not_needed text[] DEFAULT '{}';
