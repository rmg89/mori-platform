ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS post_event_item_notes jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS post_event_media jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS post_event_testimonial_link text,
  ADD COLUMN IF NOT EXISTS post_event_testimonial_text text,
  ADD COLUMN IF NOT EXISTS post_event_follow_up_date date;
