-- Add Zeno assistant settings columns to user_settings table
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS zeno_digest_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS zeno_digest_types TEXT[] DEFAULT ARRAY['morning', 'eod', 'weekly'];
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS zeno_morning_time TEXT DEFAULT '09:00';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS zeno_eod_time TEXT DEFAULT '18:00';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS vip_senders TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS focus_mode_enabled BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS focus_mode_until TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS zeno_confirmations BOOLEAN DEFAULT true;
