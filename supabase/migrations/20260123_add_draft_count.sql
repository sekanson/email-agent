-- Migration: Add draft count tracking for paywall
-- Purpose: Track number of drafts created per user for free tier limit

-- Add drafts_created_count column
ALTER TABLE users ADD COLUMN IF NOT EXISTS drafts_created_count INTEGER DEFAULT 0;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_drafts_count ON users(email, drafts_created_count);
