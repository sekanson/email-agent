/**
 * Action Queue — Types and helpers for Zeno's action system
 * 
 * Manages the queue of pending actions that Zeno can take
 * on behalf of the user (with approval).
 */

import { createClient } from "./supabase";

// ============================================
// TYPES
// ============================================

export type ActionType =
  | "draft_reply"
  | "send_email"
  | "book_meeting"
  | "accept_meeting"
  | "decline_meeting"
  | "follow_up"
  | "archive"
  | "forward";

export type ActionStatus =
  | "pending"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type ApprovalSource = "email_reply" | "dashboard" | "api" | "auto";

export interface ActionPayload {
  // draft_reply
  draft_content?: string;
  tone?: "formal" | "casual" | "friendly" | "professional";
  points_to_address?: string[];

  // send_email
  to?: string;
  subject?: string;
  body?: string;
  cc?: string[];

  // book_meeting
  title?: string;
  attendees?: string[];
  duration_minutes?: number;
  proposed_times?: string[]; // ISO date strings
  add_meet_link?: boolean;
  location?: string;

  // accept/decline meeting
  event_id?: string;
  response_message?: string;

  // forward
  forward_to?: string;
  forward_note?: string;
}

export interface ActionResult {
  // draft_reply
  draft_id?: string;

  // send_email
  message_id?: string;
  sent_at?: string;

  // book_meeting
  event_id?: string;
  event_link?: string;
  meet_link?: string;
  scheduled_time?: string;

  // Generic
  success?: boolean;
  message?: string;
}

export interface Action {
  id: string;
  user_email: string;
  email_id?: string;
  email_subject?: string;
  email_from?: string;
  thread_id?: string;
  action_type: ActionType;
  payload: ActionPayload;
  user_instruction?: string;
  status: ActionStatus;
  result?: ActionResult;
  error_message?: string;
  requires_approval: boolean;
  approved_at?: string;
  approved_via?: ApprovalSource;
  created_at: string;
  updated_at: string;
  executed_at?: string;
  expires_at: string;
  priority: number;
}

export interface CreateActionParams {
  user_email: string;
  action_type: ActionType;
  payload: ActionPayload;
  email_id?: string;
  email_subject?: string;
  email_from?: string;
  thread_id?: string;
  user_instruction?: string;
  requires_approval?: boolean;
  priority?: number;
}

export interface NotificationPreferences {
  digest_enabled: boolean;
  digest_frequency: "daily" | "twice_daily" | "weekly";
  digest_time: string; // HH:MM format
  realtime_urgent: boolean;
  realtime_respond: boolean;
  realtime_calendar: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  auto_approve_low_risk: boolean;
}

// ============================================
// ACTION QUEUE FUNCTIONS
// ============================================

/**
 * Create a new action in the queue
 */
export async function createAction(params: CreateActionParams): Promise<Action> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("action_queue")
    .insert({
      user_email: params.user_email,
      action_type: params.action_type,
      payload: params.payload,
      email_id: params.email_id,
      email_subject: params.email_subject,
      email_from: params.email_from,
      thread_id: params.thread_id,
      user_instruction: params.user_instruction,
      requires_approval: params.requires_approval ?? true,
      priority: params.priority ?? 5,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create action: ${error.message}`);
  }

  return data as Action;
}

/**
 * Get pending actions for a user
 */
export async function getPendingActions(user_email: string): Promise<Action[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("action_queue")
    .select("*")
    .eq("user_email", user_email)
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get pending actions: ${error.message}`);
  }

  return data as Action[];
}

/**
 * Approve an action
 */
export async function approveAction(
  action_id: string,
  approved_via: ApprovalSource = "dashboard"
): Promise<Action> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("action_queue")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_via,
      updated_at: new Date().toISOString(),
    })
    .eq("id", action_id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to approve action: ${error.message}`);
  }

  return data as Action;
}

/**
 * Cancel an action
 */
export async function cancelAction(action_id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("action_queue")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", action_id);

  if (error) {
    throw new Error(`Failed to cancel action: ${error.message}`);
  }
}

/**
 * Update action status after execution
 */
export async function updateActionStatus(
  action_id: string,
  status: ActionStatus,
  result?: ActionResult,
  error_message?: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("action_queue")
    .update({
      status,
      result,
      error_message,
      updated_at: new Date().toISOString(),
      executed_at: ["completed", "failed"].includes(status)
        ? new Date().toISOString()
        : undefined,
    })
    .eq("id", action_id);

  if (error) {
    throw new Error(`Failed to update action status: ${error.message}`);
  }
}

/**
 * Get actions by email ID
 */
export async function getActionsForEmail(
  user_email: string,
  email_id: string
): Promise<Action[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("action_queue")
    .select("*")
    .eq("user_email", user_email)
    .eq("email_id", email_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get actions for email: ${error.message}`);
  }

  return data as Action[];
}

/**
 * Get action history for a user
 */
export async function getActionHistory(
  user_email: string,
  limit: number = 50
): Promise<Action[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("action_queue")
    .select("*")
    .eq("user_email", user_email)
    .in("status", ["completed", "failed", "cancelled"])
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get action history: ${error.message}`);
  }

  return data as Action[];
}

// ============================================
// SENDER HISTORY FUNCTIONS
// ============================================

export interface SenderHistory {
  sender_email: string;
  sender_name?: string;
  sender_domain?: string;
  total_emails: number;
  total_replies: number;
  last_email_at: string;
  last_reply_at?: string;
  most_common_category?: number;
  is_contact: boolean;
}

/**
 * Get or create sender history
 */
export async function getSenderHistory(
  user_email: string,
  sender_email: string
): Promise<SenderHistory | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sender_history")
    .select("*")
    .eq("user_email", user_email)
    .eq("sender_email", sender_email.toLowerCase())
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = not found
    throw new Error(`Failed to get sender history: ${error.message}`);
  }

  return data as SenderHistory | null;
}

/**
 * Update sender history after an email
 */
export async function updateSenderHistory(
  user_email: string,
  sender_email: string,
  sender_name: string | undefined,
  category: number
): Promise<void> {
  const supabase = createClient();
  const normalizedSender = sender_email.toLowerCase();
  const domain = normalizedSender.split("@")[1];

  // First, try to get existing record
  const { data: existing } = await supabase
    .from("sender_history")
    .select("*")
    .eq("user_email", user_email)
    .eq("sender_email", normalizedSender)
    .single();

  if (existing) {
    // Update existing
    const categoryCount = (existing.category_counts as Record<string, number>) || {};
    categoryCount[category] = (categoryCount[category] || 0) + 1;

    // Find most common category
    const mostCommon = Object.entries(categoryCount).reduce(
      (max, [cat, count]) => (count > max.count ? { cat: parseInt(cat), count } : max),
      { cat: category, count: 0 }
    ).cat;

    await supabase
      .from("sender_history")
      .update({
        total_emails: existing.total_emails + 1,
        last_email_at: new Date().toISOString(),
        category_counts: categoryCount,
        most_common_category: mostCommon,
        sender_name: sender_name || existing.sender_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Create new
    await supabase.from("sender_history").insert({
      user_email,
      sender_email: normalizedSender,
      sender_name,
      sender_domain: domain,
      most_common_category: category,
      category_counts: { [category]: 1 },
    });
  }
}

// ============================================
// NOTIFICATION PREFERENCES
// ============================================

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences(
  user_email: string
): Promise<NotificationPreferences> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("email", user_email)
    .single();

  if (error) {
    throw new Error(`Failed to get notification preferences: ${error.message}`);
  }

  return data.notification_preferences as NotificationPreferences;
}

/**
 * Update user notification preferences
 */
export async function updateNotificationPreferences(
  user_email: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  const supabase = createClient();

  // Get current preferences first
  const current = await getNotificationPreferences(user_email);

  const { error } = await supabase
    .from("users")
    .update({
      notification_preferences: { ...current, ...preferences },
    })
    .eq("email", user_email);

  if (error) {
    throw new Error(`Failed to update notification preferences: ${error.message}`);
  }
}

/**
 * Check if it's within quiet hours for a user
 */
export function isQuietHours(preferences: NotificationPreferences): boolean {
  const now = new Date();

  // Get user's local time
  const userTime = new Date(
    now.toLocaleString("en-US", { timeZone: preferences.timezone })
  );
  const currentHour = userTime.getHours();
  const currentMinute = userTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = preferences.quiet_hours_start.split(":").map(Number);
  const [endHour, endMinute] = preferences.quiet_hours_end.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (startMinutes > endMinutes) {
    return currentTimeMinutes >= startMinutes || currentTimeMinutes < endMinutes;
  }

  return currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes;
}
