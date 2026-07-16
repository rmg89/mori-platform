-- Add deposit invoice tracking fields to engagements
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2);
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS deposit_invoice_sent_at timestamptz;
ALTER TABLE engagements ADD COLUMN IF NOT EXISTS deposit_received_at timestamptz;
