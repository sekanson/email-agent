import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import {
  sendEmail,
  createDraft,
  getEmails,
  getThreadMessages,
  formatThreadForAI,
} from "@/lib/gmail";
import { generateDraftResponse } from "@/lib/claude";
import {
  createEvent,
  respondToEvent,
  findAvailableSlots,
  formatAvailableSlots,
  parseTimeExpression,
} from "@/lib/calendar";
import {
  Action,
  updateActionStatus,
  getPendingActions,
  approveAction,
} from "@/lib/action-queue";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

/**
 * POST /api/zeno/execute
 *
 * Executes approved actions from the action queue.
 * Can execute a specific action or process all approved actions.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to execute actions");
    }

    const {
      actionId,
      executeAll = false,
      autoApprove = false,
    } = await request.json();

    const userEmail = authenticatedEmail; // Use authenticated email

    const supabase = createClient();

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user settings
    let { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    const temperature = settings?.temperature || 0.5;
    const signature = settings?.signature || "";
    const writingStyle = settings?.writing_style || "";

    // Get actions to execute
    let actionsToExecute: Action[] = [];

    if (actionId) {
      // Execute specific action
      const { data: action, error } = await supabase
        .from("action_queue")
        .select("*")
        .eq("id", actionId)
        .eq("user_email", userEmail)
        .single();

      if (error || !action) {
        return NextResponse.json(
          { error: "Action not found" },
          { status: 404 }
        );
      }

      actionsToExecute = [action as Action];
    } else if (executeAll) {
      // Get all approved actions (or pending if autoApprove)
      const { data: actions, error } = await supabase
        .from("action_queue")
        .select("*")
        .eq("user_email", userEmail)
        .in("status", autoApprove ? ["pending", "approved"] : ["approved"])
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      actionsToExecute = (actions as Action[]) || [];
    }

    if (actionsToExecute.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No actions to execute",
        executed: 0,
      });
    }

    // Execute each action
    const results = [];

    for (const action of actionsToExecute) {
      try {
        // Auto-approve if needed
        if (action.status === "pending" && autoApprove) {
          await approveAction(action.id, "auto");
        }

        // Mark as executing
        await updateActionStatus(action.id, "executing");

        // Execute based on action type
        let result;

        switch (action.action_type) {
          case "draft_reply":
            result = await executeDraftReply(action, user, {
              temperature,
              signature,
              writingStyle,
            });
            break;

          case "send_email":
            result = await executeSendEmail(action, user);
            break;

          case "book_meeting":
            result = await executeBookMeeting(action, user, userEmail);
            break;

          case "accept_meeting":
            result = await executeRespondMeeting(action, user, userEmail, "accepted");
            break;

          case "decline_meeting":
            result = await executeRespondMeeting(action, user, userEmail, "declined");
            break;

          case "follow_up":
            result = await executeFollowUp(action, user, { signature });
            break;

          case "archive":
            result = await executeArchive(action, user);
            break;

          default:
            result = { success: false, message: `Unknown action type: ${action.action_type}` };
        }

        // Update action status
        if (result.success) {
          await updateActionStatus(action.id, "completed", result);
        } else {
          await updateActionStatus(action.id, "failed", undefined, result.message);
        }

        results.push({
          actionId: action.id,
          actionType: action.action_type,
          emailSubject: action.email_subject,
          success: result.success,
          result,
        });
      } catch (actionError: any) {
        console.error(`Failed to execute action ${action.id}:`, actionError);
        await updateActionStatus(action.id, "failed", undefined, actionError.message);
        results.push({
          actionId: action.id,
          actionType: action.action_type,
          success: false,
          error: actionError.message,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      executed: results.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error("Error executing actions:", error);
    return NextResponse.json(
      { error: "Failed to execute actions" },
      { status: 500 }
    );
  }
}

/**
 * Execute draft reply action
 */
async function executeDraftReply(
  action: Action,
  user: any,
  options: { temperature: number; signature: string; writingStyle: string }
): Promise<any> {
  const { temperature, signature, writingStyle } = options;
  const payload = action.payload;

  // Get the original email
  const emails = await getEmails(
    user.access_token,
    user.refresh_token,
    50,
    `rfc822msgid:${action.email_id}`
  );

  // If we can't find by ID, try to find a recent email matching subject
  let email = emails[0];
  if (!email && action.email_subject) {
    const subjectEmails = await getEmails(
      user.access_token,
      user.refresh_token,
      10,
      `subject:"${action.email_subject}"`
    );
    email = subjectEmails[0];
  }

  if (!email) {
    return { success: false, message: "Could not find original email" };
  }

  // Get thread context
  let threadContext = "";
  try {
    const threadMessages = await getThreadMessages(
      user.access_token,
      user.refresh_token,
      email.threadId,
      user.email
    );
    threadContext = formatThreadForAI(threadMessages);
  } catch {
    console.log("Could not load thread context");
  }

  // Build prompt additions from payload
  let additionalPrompt = "";
  if (payload.tone) {
    additionalPrompt += `\nTone: ${payload.tone}`;
  }
  if (payload.points_to_address && payload.points_to_address.length > 0) {
    additionalPrompt += `\nKey points to address: ${payload.points_to_address.join(", ")}`;
  }
  if (action.user_instruction) {
    additionalPrompt += `\nUser instruction: ${action.user_instruction}`;
  }

  // Generate the draft
  const draftBody = await generateDraftResponse(
    email.from,
    email.subject,
    email.body || email.bodyPreview,
    temperature,
    signature,
    writingStyle + additionalPrompt,
    threadContext
  );

  // Extract sender email
  const senderMatch = email.from.match(/<([^>]+)>/) || [null, email.from];
  const senderEmail = senderMatch[1] || email.from;

  // Create the draft
  const draftId = await createDraft(
    user.access_token,
    user.refresh_token,
    senderEmail,
    email.subject,
    draftBody,
    email.threadId
  );

  return {
    success: true,
    draft_id: draftId,
    message: "Draft created successfully",
  };
}

/**
 * Execute send email action
 * Handles both direct sends (with to/body) and smart sends (with recipient name/message intent)
 */
async function executeSendEmail(action: Action, user: any): Promise<any> {
  const payload = action.payload;

  let recipientEmail = payload.to;
  let emailBody = payload.body;
  let emailSubject = payload.subject || `Re: ${action.email_subject || "Following up"}`;

  // If we have a recipient name but no email, try to resolve it
  if (!recipientEmail && payload.recipient) {
    const resolved = await resolveNameToEmail(payload.recipient, user.access_token, user.refresh_token);
    recipientEmail = resolved || undefined;
    
    if (!recipientEmail) {
      return { 
        success: false, 
        message: `Could not find email address for "${payload.recipient}". Try specifying the full email.` 
      };
    }
  }

  // If we have message intent but no full body, generate it
  if (!emailBody && (payload.message || payload.points_to_address || action.user_instruction)) {
    const messageIntent = payload.message || 
      (payload.points_to_address ? payload.points_to_address.join(", ") : "") ||
      action.user_instruction;

    // Get user settings for writing style
    const supabase = createClient();
    const { data: settings } = await supabase
      .from("user_settings")
      .select("signature, writing_style")
      .eq("user_email", user.email)
      .single();

    const signature = settings?.signature || "";
    
    // Generate professional email body
    emailBody = `Hi ${payload.recipient || "there"},

${messageIntent}

Please let me know if you have any questions.

${signature}`.trim();
  }

  if (!recipientEmail || !emailBody) {
    return { success: false, message: "Could not determine recipient email or message body" };
  }

  // For safety, create a draft instead of sending directly
  // User can review and send from Gmail
  const draftId = await createDraft(
    user.access_token,
    user.refresh_token,
    recipientEmail,
    emailSubject,
    emailBody,
    action.thread_id || ""
  );

  return {
    success: true,
    message: `Draft created for ${recipientEmail} (review and send from Gmail)`,
    draft_id: draftId,
    to: recipientEmail,
  };
}

/**
 * Helper: Resolve a name to an email address by searching recent emails
 */
async function resolveNameToEmail(
  name: string,
  accessToken: string,
  refreshToken: string
): Promise<string | null> {
  // If it already looks like an email, return it
  if (name.includes("@")) return name;

  try {
    const recentEmails = await getEmails(
      accessToken,
      refreshToken,
      50,
      `from:${name} OR to:${name}`
    );

    for (const email of recentEmails) {
      const nameLower = name.toLowerCase();
      if (email.from.toLowerCase().includes(nameLower)) {
        const match = email.from.match(/<([^>]+)>/);
        return match ? match[1] : email.fromEmail;
      }
      if (email.to?.toLowerCase().includes(nameLower)) {
        const match = email.to.match(/<([^>]+)>/);
        if (match) return match[1];
      }
    }
  } catch (e) {
    console.error(`Failed to resolve name "${name}":`, e);
  }
  return null;
}

/**
 * Execute book meeting action
 */
async function executeBookMeeting(
  action: Action,
  user: any,
  userEmail: string
): Promise<any> {
  const payload = action.payload;

  // Get user's timezone preference (default EST)
  const supabase = createClient();
  const { data: userPrefs } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("email", userEmail)
    .single();
  
  const userTimezone = userPrefs?.notification_preferences?.timezone || "America/New_York";
  
  // Calculate timezone offset (EST = UTC-5, EDT = UTC-4)
  // For simplicity, assume EST (-5 hours = -300 minutes)
  const tzOffsetMinutes = userTimezone.includes("New_York") ? -300 : 0;
  
  // Parse proposed times
  let startTime: Date | null = null;
  if (payload.proposed_times && payload.proposed_times.length > 0) {
    startTime = parseTimeExpression(payload.proposed_times[0]);
    
    // Adjust for timezone: server is UTC, user wants local time
    // If user says "10 AM", they mean 10 AM EST = 3 PM UTC
    if (startTime) {
      startTime = new Date(startTime.getTime() - tzOffsetMinutes * 60 * 1000);
    }
  }

  // If no valid time, find available slots
  if (!startTime) {
    const slots = await findAvailableSlots(
      user.access_token,
      user.refresh_token,
      userEmail,
      payload.duration_minutes || 30
    );

    if (slots.length === 0) {
      return {
        success: false,
        message: "No available slots found",
      };
    }

    // Use first available slot
    startTime = slots[0].start;
  }

  const durationMinutes = payload.duration_minutes || 30;
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  // Resolve attendee names to email addresses
  let attendeeEmails: string[] = [];
  if (payload.attendees && payload.attendees.length > 0) {
    for (const attendee of payload.attendees) {
      const email = await resolveNameToEmail(attendee, user.access_token, user.refresh_token);
      if (email) {
        attendeeEmails.push(email);
      } else {
        console.log(`Could not resolve attendee "${attendee}" to email`);
      }
    }
  }

  // Fallback to email from action if no attendees resolved
  if (attendeeEmails.length === 0 && action.email_from) {
    const match = action.email_from.match(/<([^>]+)>/);
    if (match) attendeeEmails.push(match[1]);
  }

  // Create the event
  const event = await createEvent(user.access_token, user.refresh_token, {
    summary: payload.title || `Meeting: ${action.email_subject || "Discussion"}`,
    description: action.user_instruction,
    start: startTime,
    end: endTime,
    attendees: attendeeEmails.length > 0 ? attendeeEmails : undefined,
    addMeetLink: payload.add_meet_link !== false,
    sendInvites: attendeeEmails.length > 0,
  });

  return {
    success: true,
    event_id: event.id,
    event_link: event.meetLink,
    scheduled_time: startTime.toISOString(),
    attendees_invited: attendeeEmails,
    message: `Meeting booked for ${startTime.toLocaleString()}${attendeeEmails.length > 0 ? ` with ${attendeeEmails.join(", ")}` : ""}`,
  };
}

/**
 * Execute meeting response (accept/decline)
 */
async function executeRespondMeeting(
  action: Action,
  user: any,
  userEmail: string,
  response: "accepted" | "declined"
): Promise<any> {
  const eventId = action.payload.event_id;

  if (!eventId) {
    return {
      success: false,
      message: "No event ID provided",
    };
  }

  await respondToEvent(
    user.access_token,
    user.refresh_token,
    eventId,
    response,
    userEmail
  );

  return {
    success: true,
    message: `Meeting ${response}`,
  };
}

/**
 * Execute follow-up email
 */
async function executeFollowUp(
  action: Action,
  user: any,
  options: { signature: string }
): Promise<any> {
  const followUpBody = `Hi,

I wanted to follow up on my previous email regarding "${action.email_subject}".

Please let me know if you have any questions or need any additional information.

${options.signature}`;

  const senderEmail = action.email_from?.match(/<([^>]+)>/)?.[1] || action.email_from;

  if (!senderEmail) {
    return { success: false, message: "Could not determine recipient email" };
  }

  await sendEmail(
    user.access_token,
    user.refresh_token,
    senderEmail,
    `Re: ${action.email_subject}`,
    followUpBody,
    action.thread_id
  );

  return {
    success: true,
    message: "Follow-up sent",
  };
}

/**
 * Execute archive action
 */
async function executeArchive(action: Action, user: any): Promise<any> {
  // In Gmail, archiving means removing from INBOX
  const gmail = await import("googleapis").then((m) => m.google.gmail);
  const { google } = await import("googleapis");

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: user.access_token,
    refresh_token: user.refresh_token,
  });

  const gmailClient = gmail({ version: "v1", auth: oauth2Client });

  await gmailClient.users.messages.modify({
    userId: "me",
    id: action.email_id!,
    requestBody: {
      removeLabelIds: ["INBOX"],
    },
  });

  return {
    success: true,
    message: "Email archived",
  };
}
