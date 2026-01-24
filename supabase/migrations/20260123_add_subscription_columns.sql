-- Migration: Add subscription and admin columns to users table
-- Purpose: Support Stripe subscriptions, trial management, and admin portal

-- Add subscription management columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'trial';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set trial_ends_at to 14 days from now for existing users without it
UPDATE users
SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE trial_ends_at IS NULL;

-- Set created_at for existing users without it
UPDATE users
SET created_at = updated_at
WHERE created_at IS NULL AND updated_at IS NOT NULL;

-- Create index for Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Create index for subscription status queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
