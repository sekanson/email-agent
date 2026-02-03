-- Create test user for Mirmi (mirmi@xix3d.com)
-- Run this in Supabase SQL Editor

INSERT INTO users (
  email,
  name,
  picture,
  subscription_status,
  subscription_tier,
  drafts_created_count,
  gmail_connected,
  calendar_connected,
  created_at,
  updated_at
) VALUES (
  'mirmi@xix3d.com',
  'Mirmi',
  NULL,
  'trial',
  'free',
  0,
  false,
  false,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- Also create user_settings entry
INSERT INTO user_settings (
  user_email,
  email,
  temperature,
  drafts_enabled,
  labels_enabled,
  "schemaVersions",
  "upgradePromptsShown",
  created_at,
  updated_at
) VALUES (
  'mirmi@xix3d.com',
  'mirmi@xix3d.com',
  0.7,
  true,
  true,
  '{"categories": "v2", "draftTemplates": "v1", "notifications": "v1"}'::jsonb,
  '{}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (user_email) DO UPDATE SET
  updated_at = NOW();
