-- Add missing focus mode columns to user_settings table
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS focus_mode_filter_id TEXT DEFAULT NULL;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS focus_mode_label_id TEXT DEFAULT NULL;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS focus_mode_started_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS focus_mode_ended_at TIMESTAMPTZ DEFAULT NULL;
