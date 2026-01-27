import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { createDraft, sendEmail } from "@/lib/gmail";
import { sendActionConfirmation } from "@/lib/zeno-mailer";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ParsedAction {
  type: "reply" | "draft" | "send" | "schedule" | "tell" | "unknown";
  targetEmail?: string;
  targetName?: string;
  message?: string;
  replyNumber?: number;
  meetingDetails?: {
    attendees: string[];
    date: string;
    time: string;
    duration?: number;
    subject?: string;
  };
  confidence: number;
  rawIntent: string;
}

interface RecentEmail {
  gmail_id: string;
  from: string;
  from_email: string;
  subject: string;
  thread_id?: string;
}

// Parse user's reply using Claude
async function parseUserIntent(
  userReply: string,
  recentEmails: RecentEmail[],
  knownContacts: { name: string; email: string }[]
): Promise<ParsedAction[]> {
  
  const recentEmailsContext = recentEmails
    .map((e, i) => `${i + 1}. From: ${e.from} (${e.from_email}), Subject: "${e.subject}"`)
    .join("\n");

  const contactsContext = knownContacts
    .map(c => `- ${c.name}: ${c.email}`)
    .join("\n");

  const prompt = `You are parsing a user's email reply to their AI email assistant (Zeno).
The user wants to take actions on their emails. Parse their intent into structured actions.

RECENT EMAILS (numbered for "Reply 1/2/3" references):
${recentEmailsContext || "No recent emails"}

KNOWN CONTACTS:
${contactsContext || "No contacts loaded"}

USER'S REPLY:
"${userReply}"

Parse this into one or more actions. Each action should be one of:
- reply: Send a quick reply to a numbered email (e.g., "Reply 1 with: sounds good")
- draft: Create a draft reply (e.g., "Draft a reply to Sarah saying...")
- send: Send an email directly (e.g., "Tell Aamir I'll be there")
- schedule: Schedule a meeting (e.g., "Schedule meeting with X tomorrow at 9am")

Respond in JSON format:
{
  "actions": [
    {
      "type": "reply|draft|send|schedule",
      "targetEmail": "email@example.com",
      "targetName": "Person Name",
      "message": "The message content to send",
      "replyNumber": 1,
      "meetingDetails": {
        "attendees": ["email1@example.com"],
        "date": "2024-01-28",
        "time": "09:00",
        "duration": 30,
        "subject": "Meeting subject"
      },
      "confidence": 0.95,
      "rawIntent": "what the user seemed to want"
    }
  ]
}

Rules:
- Match names to known contacts when possible
- For "Reply 1/2/3", reference the numbered emails above
- If you can't determine the target, set confidence low and include what you understood
- Parse multiple actions if the user requested multiple things
- For schedules, parse relative dates (tomorrow, next Monday, etc.) to actual dates

Return ONLY valid JSON, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.actions || [];

  } catch (error) {
    console.error("Failed to parse user intent:", error);
    return [{
      type: "unknown",
      confidence: 0,
      rawIntent: userReply,
    }];
  }
}

// Execute a parsed action
async function executeAction(
  action: ParsedAction,
  user: any,
  recentEmails: RecentEmail[]
): Promise<{ success: boolean; result: string }> {
  
  switch (action.type) {
    case "reply": {
      // Quick reply to a numbered email
      if (!action.replyNumber || action.replyNumber > recentEmails.length) {
        return { success: false, result: `Invalid reply number: ${action.replyNumber}` };
      }
      
      const targetEmail = recentEmails[action.replyNumber - 1];
      if (!targetEmail) {
        return { success: false, result: "Could not find the email to reply to" };
      }

      try {
        await createDraft(
          user.access_token,
          user.refresh_token,
          targetEmail.from_email,
          targetEmail.subject,
          action.message || "",
          targetEmail.thread_id || targetEmail.gmail_id,
          undefined,
          user.email
        );
        return { 
          success: true, 
          result: `Created draft reply to ${targetEmail.from}: "${action.message?.slice(0, 50)}..."` 
        };
      } catch (error: any) {
        return { success: false, result: `Failed to create draft: ${error.message}` };
      }
    }

    case "draft": {
      // Create a draft to a specific person
      if (!action.targetEmail) {
        return { success: false, result: `Could not determine who to draft email to. You said: "${action.rawIntent}"` };
      }

      try {
        // Find if this is a reply to an existing thread
        const existingThread = recentEmails.find(
          e => e.from_email.toLowerCase() === action.targetEmail?.toLowerCase()
        );

        await createDraft(
          user.access_token,
          user.refresh_token,
          action.targetEmail,
          existingThread?.subject || `Re: ${action.targetName || ""}`,
          action.message || "",
          existingThread?.thread_id || existingThread?.gmail_id || "",
          undefined,
          user.email
        );
        return { 
          success: true, 
          result: `Created draft to ${action.targetName || action.targetEmail}: "${action.message?.slice(0, 50)}..."` 
        };
      } catch (error: any) {
        return { success: false, result: `Failed to create draft: ${error.message}` };
      }
    }

    case "send": {
      // Send email directly (for quick messages to known contacts)
      if (!action.targetEmail || !action.message) {
        return { 
          success: false, 
          result: `Could not determine recipient or message. You said: "${action.rawIntent}"` 
        };
      }

      // For safety, create draft instead of sending directly
      // User can review and send from Gmail
      try {
        await createDraft(
          user.access_token,
          user.refresh_token,
          action.targetEmail,
          `Message from ${user.name || user.email}`,
          action.message,
          "",
          undefined,
          user.email
        );
        return { 
          success: true, 
          result: `Created draft message to ${action.targetName || action.targetEmail}: "${action.message.slice(0, 50)}..." (Review and send from Gmail)` 
        };
      } catch (error: any) {
        return { success: false, result: `Failed to create message: ${error.message}` };
      }
    }

    case "schedule": {
      // Schedule a meeting (requires calendar integration)
      const details = action.meetingDetails;
      if (!details || !details.attendees?.length) {
        return { 
          success: false, 
          result: `Could not parse meeting details. You said: "${action.rawIntent}"` 
        };
      }

      // For now, create a calendar invite email draft
      // Full calendar integration would use Google Calendar API
      const attendeeList = details.attendees.join(", ");
      const meetingBody = `Hi,

I'd like to schedule a meeting:

Date: ${details.date}
Time: ${details.time}
Duration: ${details.duration || 30} minutes
${details.subject ? `Topic: ${details.subject}` : ""}

Please let me know if this works for you.`;

      try {
        await createDraft(
          user.access_token,
          user.refresh_token,
          details.attendees[0],
          details.subject || `Meeting Request - ${details.date} at ${details.time}`,
          meetingBody,
          "",
          details.attendees.length > 1 ? details.attendees.slice(1).join(", ") : undefined,
          user.email
        );
        return { 
          success: true, 
          result: `Created meeting request draft for ${attendeeList} on ${details.date} at ${details.time}. Review and send from Gmail to create calendar invite.` 
        };
      } catch (error: any) {
        return { success: false, result: `Failed to create meeting request: ${error.message}` };
      }
    }

    default:
      return { 
        success: false, 
        result: `I couldn't understand that request. You said: "${action.rawIntent}". Try something like "Reply 1 with: sounds good" or "Draft a reply to Sarah saying..."` 
      };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userEmail, replyContent, inReplyToMessageId } = await request.json();

    if (!userEmail || !replyContent) {
      return NextResponse.json(
        { error: "userEmail and replyContent required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get recent emails for context (what we sent in the digest)
    const { data: recentEmails } = await supabase
      .from("emails")
      .select("gmail_id, from, from_email, subject, thread_id")
      .eq("user_email", userEmail)
      .in("category", [1, 5])
      .order("processed_at", { ascending: false })
      .limit(10);

    // Get known contacts from email history
    const { data: contacts } = await supabase
      .from("emails")
      .select("from, from_email")
      .eq("user_email", userEmail)
      .limit(100);

    const uniqueContacts = new Map<string, { name: string; email: string }>();
    for (const c of contacts || []) {
      const email = c.from_email?.toLowerCase();
      if (email && !uniqueContacts.has(email)) {
        // Extract name from "Name <email>" format
        const nameMatch = c.from?.match(/^([^<]+)</);
        const name = nameMatch ? nameMatch[1].trim() : email.split("@")[0];
        uniqueContacts.set(email, { name, email });
      }
    }

    // Parse the user's intent
    const actions = await parseUserIntent(
      replyContent,
      recentEmails || [],
      Array.from(uniqueContacts.values())
    );

    console.log("Parsed actions:", JSON.stringify(actions, null, 2));

    // Execute each action
    const results: { action: string; success: boolean; result: string }[] = [];

    for (const action of actions) {
      if (action.confidence < 0.5) {
        results.push({
          action: action.type,
          success: false,
          result: `Low confidence parsing: "${action.rawIntent}". Please be more specific.`,
        });
        continue;
      }

      const result = await executeAction(action, user, recentEmails || []);
      results.push({
        action: action.type,
        ...result,
      });
    }

    // Send confirmation email back to user
    const successCount = results.filter(r => r.success).length;
    const summaryResult = results.map(r => 
      `${r.success ? "✅" : "❌"} ${r.result}`
    ).join("\n\n");

    await sendActionConfirmation({
      to: userEmail,
      userName: user.name || userEmail.split("@")[0],
      action: `${successCount}/${results.length} actions completed`,
      result: summaryResult,
      originalRequest: replyContent,
    });

    return NextResponse.json({
      success: successCount > 0,
      totalActions: actions.length,
      successCount,
      results,
    });

  } catch (error: any) {
    console.error("Failed to process reply:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
