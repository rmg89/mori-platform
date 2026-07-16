ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS booking_review_needed boolean DEFAULT false;
