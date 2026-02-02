-- Add missing draft-related columns to user_settings table
-- These are expected by settings-merge.ts DEFAULT_USER_SETTINGS but were never migrated

-- Draft generation settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS temperature DECIMAL DEFAULT 0.7;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT '';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS drafts_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS use_writing_style BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS writing_style TEXT DEFAULT '';

-- Categories (JSONB to store the category configurations)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '{}'::jsonb;

-- Auto-polling settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_poll_enabled BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS auto_poll_interval INTEGER DEFAULT 120;
