// Declutter Feature Type Definitions

export type SubscriptionStatus = 'active' | 'unsubscribed' | 'blocked' | 'kept';
export type UserAction = 'keep' | 'unsubscribe' | 'block' | null;
export type SessionType = 'daily_summary' | 'weekly_summary' | 'bulk_cleanup' | 'subscription_audit';
export type BulkAction = 'archive' | 'delete';
export type SummaryType = 'daily' | 'weekly';

// Database types
export interface EmailSubscription {
  id: string;
  user_email: string;
  sender_email: string;
  sender_name: string | null;
  email_count: number;
  last_seen_at: string;
  unsubscribe_link: string | null;
  status: SubscriptionStatus;
  user_action: UserAction;
  created_at: string;
  updated_at: string;
}

export interface ImportantEmail {
  gmail_id: string;
  subject: string;
  from: string;
  reason: string;
}

export interface DeclutterSession {
  id: string;
  user_email: string;
  session_type: SessionType;
  emails_processed: number;
  emails_archived: number;
  emails_deleted: number;
  subscriptions_found: number;
  summary_text: string | null;
  important_emails: ImportantEmail[] | null;
  created_at: string;
}

// API Request/Response types

// POST /api/declutter/scan
export interface ScanRequest {
  userEmail: string;
  daysToScan?: number; // Default 30
}

export interface ScanResponse {
  subscriptions: EmailSubscription[];
  totalEmails: number;
  newSubscriptionsFound: number;
}

// GET /api/declutter/subscriptions
export interface GetSubscriptionsResponse {
  subscriptions: EmailSubscription[];
  stats: {
    total: number;
    active: number;
    unsubscribed: number;
    blocked: number;
    kept: number;
    pending: number;
  };
}

// POST /api/declutter/action
export interface ActionRequest {
  userEmail: string;
  senderEmail: string;
  action: 'keep' | 'unsubscribe' | 'block';
}

export interface ActionResponse {
  success: boolean;
  message: string;
  subscription: EmailSubscription;
}

// POST /api/declutter/bulk-cleanup
export interface BulkCleanupRequest {
  userEmail: string;
  action: BulkAction;
  olderThanDays: number;
  categories?: string[]; // e.g., ['Marketing/Spam', 'Notification']
  senders?: string[]; // Specific sender emails
}

export interface BulkCleanupResponse {
  success: boolean;
  processed: number;
  archived: number;
  deleted: number;
  sessionId: string;
}

// POST /api/declutter/generate-summary
export interface GenerateSummaryRequest {
  userEmail: string;
  type: SummaryType;
}

export interface GenerateSummaryResponse {
  summary: string;
  importantEmails: ImportantEmail[];
  stats: {
    totalEmails: number;
    categorizedEmails: number;
    needsResponse: number;
    newsletters: number;
  };
  sessionId: string;
}

// Utility types for internal use
export interface EmailHeader {
  name: string;
  value: string;
}

export interface ParsedUnsubscribeInfo {
  link: string | null;
  email: string | null;
  method: 'link' | 'email' | 'none';
}
