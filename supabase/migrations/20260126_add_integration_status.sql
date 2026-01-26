-- Add integration status tracking to users table
-- This allows login to be separate from Gmail/Calendar connections

-- Gmail integration status
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_connected BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_connected_at TIMESTAMP WITH TIME ZONE;

-- Calendar integration status
ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_connected BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_connected_at TIMESTAMP WITH TIME ZONE;

-- Backfill: Mark existing users with tokens as having connected integrations
UPDATE users 
SET 
  gmail_connected = true,
  gmail_connected_at = created_at,
  calendar_connected = true,
  calendar_connected_at = created_at
WHERE access_token IS NOT NULL;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_gmail_connected ON users(gmail_connected);
CREATE INDEX IF NOT EXISTS idx_users_calendar_connected ON users(calendar_connected);
