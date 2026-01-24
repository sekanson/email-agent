-- Migration: Add classification metadata columns to emails table
-- Purpose: Support thread detection, sender context, and classification debugging

-- Add new columns for classification metadata
ALTER TABLE emails ADD COLUMN IF NOT EXISTS classification_reasoning TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS classification_confidence DECIMAL(3,2);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_thread BOOLEAN DEFAULT FALSE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS sender_known BOOLEAN DEFAULT FALSE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS from_email TEXT;

-- Create indexes for efficient sender context queries
CREATE INDEX IF NOT EXISTS idx_emails_from_email ON emails(user_email, from_email);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(user_email, thread_id);

-- Backfill from_email for existing records (extract email from "Name <email>" format)
UPDATE emails
SET from_email = LOWER(
  CASE
    WHEN "from" LIKE '%<%>%' THEN
      SUBSTRING("from" FROM '<([^>]+)>')
    ELSE
      TRIM("from")
  END
)
WHERE from_email IS NULL;
