ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS wrap_up_review_needed boolean DEFAULT false;
