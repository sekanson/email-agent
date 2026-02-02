-- Add missing draft-related columns to user_settings table
-- These columns are required by the settings UI but were missing from the initial schema

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS temperature DECIMAL DEFAULT 0.7;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT '';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS drafts_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS use_writing_style BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS writing_style TEXT DEFAULT '';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '{}'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_poll_enabled BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_poll_interval INTEGER DEFAULT 120;
