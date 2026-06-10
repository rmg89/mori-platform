ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS post_event_item_notes jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS post_event_media jsonb DEFAULT '[]';
