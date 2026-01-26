-- Migration: Action Queue for Zeno Proactive Assistant
-- Purpose: Track pending actions, approvals, and execution status

-- ============================================
-- ACTION QUEUE TABLE
-- ============================================
-- Stores all pending and completed actions Zeno can take

CREATE TABLE IF NOT EXISTS action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  
  -- Source email that triggered this action
  email_id TEXT,
  email_subject TEXT,
  email_from TEXT,
  thread_id TEXT,
  
  -- Action details
  action_type TEXT NOT NULL CHECK (action_type IN (
    'draft_reply',      -- Create a draft response
    'send_email',       -- Send an email directly
    'book_meeting',     -- Create calendar event
    'accept_meeting',   -- Accept calendar invite
    'decline_meeting',  -- Decline calendar invite
    'follow_up',        -- Send follow-up email
    'archive',          -- Archive the email
    'forward'           -- Forward to someone
  )),
  
  -- Action payload (JSON - content varies by action type)
  -- draft_reply: { draft_content, tone, points_to_address }
  -- send_email: { to, subject, body, cc }
  -- book_meeting: { title, attendees, duration_minutes, proposed_times }
  -- etc.
  payload JSONB NOT NULL DEFAULT '{}',
  
  -- User instruction that triggered this action
  user_instruction TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Waiting for user approval
    'approved',         -- User approved, ready to execute
    'executing',        -- Currently being processed
    'completed',        -- Successfully executed
    'failed',           -- Execution failed
    'cancelled'         -- User cancelled
  )),
  
  -- Execution results
  result JSONB,
  error_message TEXT,
  
  -- Approval tracking
  requires_approval BOOLEAN DEFAULT TRUE,
  approved_at TIMESTAMPTZ,
  approved_via TEXT CHECK (approved_via IN ('email_reply', 'dashboard', 'api', 'auto')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Priority (1 = highest)
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_action_queue_user ON action_queue(user_email);
CREATE INDEX IF NOT EXISTS idx_action_queue_status ON action_queue(status);
CREATE INDEX IF NOT EXISTS idx_action_queue_user_pending ON action_queue(user_email, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_action_queue_email ON action_queue(email_id);
CREATE INDEX IF NOT EXISTS idx_action_queue_expires ON action_queue(expires_at) WHERE status = 'pending';

-- ============================================
-- DIGEST TRACKING TABLE  
-- ============================================
-- Tracks when digests were sent and what was included

CREATE TABLE IF NOT EXISTS digest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  
  -- Digest type
  digest_type TEXT NOT NULL CHECK (digest_type IN (
    'daily',            -- Daily summary
    'realtime',         -- Urgent/important email notification
    'weekly'            -- Weekly summary
  )),
  
  -- What was included
  email_ids TEXT[] NOT NULL DEFAULT '{}',
  email_count INTEGER NOT NULL DEFAULT 0,
  
  -- Categories breakdown
  respond_count INTEGER DEFAULT 0,
  calendar_count INTEGER DEFAULT 0,
  other_count INTEGER DEFAULT 0,
  
  -- Delivery status
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered BOOLEAN DEFAULT TRUE,
  opened_at TIMESTAMPTZ,
  
  -- User response
  reply_received BOOLEAN DEFAULT FALSE,
  reply_at TIMESTAMPTZ,
  reply_content TEXT,
  actions_taken INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_digest_log_user ON digest_log(user_email);
CREATE INDEX IF NOT EXISTS idx_digest_log_sent ON digest_log(sent_at);

-- ============================================
-- USER NOTIFICATION PREFERENCES
-- ============================================
-- User settings for how/when to receive notifications

ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "digest_enabled": true,
  "digest_frequency": "daily",
  "digest_time": "08:00",
  "realtime_urgent": true,
  "realtime_respond": true,
  "realtime_calendar": true,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "07:00",
  "timezone": "America/New_York",
  "auto_approve_low_risk": false
}'::jsonb;

-- ============================================
-- SENDER HISTORY TABLE
-- ============================================
-- Track sender history for context (who has the user talked to)

CREATE TABLE IF NOT EXISTS sender_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  
  -- Interaction stats
  total_emails INTEGER DEFAULT 1,
  total_replies INTEGER DEFAULT 0,
  last_email_at TIMESTAMPTZ DEFAULT NOW(),
  last_reply_at TIMESTAMPTZ,
  
  -- Most common category for this sender
  most_common_category INTEGER,
  category_counts JSONB DEFAULT '{}',
  
  -- Sender metadata
  sender_name TEXT,
  sender_domain TEXT,
  is_contact BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_email, sender_email)
);

CREATE INDEX IF NOT EXISTS idx_sender_history_user ON sender_history(user_email);
CREATE INDEX IF NOT EXISTS idx_sender_history_lookup ON sender_history(user_email, sender_email);
CREATE INDEX IF NOT EXISTS idx_sender_history_domain ON sender_history(user_email, sender_domain);

-- ============================================
-- HELPER FUNCTION: Update action status
-- ============================================

CREATE OR REPLACE FUNCTION update_action_status(
  action_id UUID,
  new_status TEXT,
  result_data JSONB DEFAULT NULL,
  error_msg TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE action_queue
  SET 
    status = new_status,
    result = COALESCE(result_data, result),
    error_message = error_msg,
    updated_at = NOW(),
    executed_at = CASE WHEN new_status IN ('completed', 'failed') THEN NOW() ELSE executed_at END
  WHERE id = action_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Cleanup expired actions
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_actions() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM action_queue
    WHERE status = 'pending' AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
