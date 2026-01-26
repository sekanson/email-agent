import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase";
import {
  createAction,
  ActionType,
  ActionPayload,
} from "@/lib/action-queue";
import { DigestEmail } from "@/lib/zeno-digest";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ParsedInstruction {
  emailIndex: number | null;  // null for standalone actions like calendar bookings
  emailId?: string;
  actionType: ActionType;
  payload: ActionPayload;
  rawInstruction: string;
  confidence: number;
}

/**
 * POST /api/zeno/parse-reply
 * 
 * Parses a user's reply to a digest email and extracts action instructions.
 * 
 * Examples:
 * - "#1: draft a polite decline"
 * - "#2: accept the meeting"
 * - "#3: book a call for next Tuesday at 2pm"
 * - "1 - say I'll get back to them next week"
 * 
 * Body: { 
 *   userEmail: string,
 *   replyContent: string,
 *   digestEmails: DigestEmail[]  // The emails from the original digest
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { userEmail, replyContent, digestEmails } = await request.json();

    if (!userEmail || !replyContent) {
      return NextResponse.json(
        { error: "User email and reply content are required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Build context about the emails for Claude to understand
    const emailContext = digestEmails
      .map(
        (email: DigestEmail, index: number) =>
          `[${index + 1}] From: ${email.from}\n    Subject: ${email.subject}\n    Preview: ${email.bodyPreview.slice(0, 100)}...`
      )
      .join("\n\n");

    // Use Claude to parse the instructions
    const prompt = `You are parsing a user's reply to an email digest. Extract ALL action instructions - both email-related AND standalone (like calendar bookings).

DIGEST EMAILS (for context):
${emailContext}

USER'S REPLY:
${replyContent}

Parse ALL instructions and return a JSON array. Each action should have:
- emailIndex: which email (1-indexed) OR null for standalone actions (like calendar bookings)
- actionType: one of "draft_reply", "send_email", "book_meeting", "accept_meeting", "decline_meeting", "follow_up", "archive", "forward"
- payload: relevant details (see examples below)
- rawInstruction: the original instruction text
- confidence: 0.0 to 1.0

IMPORTANT: Look for ALL types of requests:
1. EMAIL ACTIONS (tied to digest emails):
   - "#1: draft a polite decline" → emailIndex: 1, actionType: "draft_reply", payload: { tone: "polite", points_to_address: ["decline"] }
   - "Tell Tony we'll have answers Wednesday" → find Tony's email, actionType: "draft_reply" or "send_email"

2. CALENDAR ACTIONS (standalone, emailIndex: null):
   - "book me time on Tuesday for an hour with Aamir" → emailIndex: null, actionType: "book_meeting", payload: { 
       proposed_times: ["Tuesday"], 
       duration_minutes: 60, 
       attendees: ["Aamir"],
       title: "Review meeting"
     }
   - "schedule a call next week" → emailIndex: null, actionType: "book_meeting", payload: { proposed_times: ["next week"] }

3. MULTIPLE ACTIONS: Users often request multiple things. Parse EACH one separately!
   Example: "Tell Tony we'll respond Wednesday, and book a meeting with Aamir Tuesday"
   → Returns 2 actions: one draft_reply + one book_meeting

Respond with ONLY valid JSON array, no markdown, no explanation:
[{ "emailIndex": 1, "actionType": "...", "payload": {...}, "rawInstruction": "...", "confidence": 0.95 }]

If no valid instructions found, return an empty array: []`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Parse the JSON response
    let parsedInstructions: ParsedInstruction[];
    try {
      parsedInstructions = JSON.parse(content.text.trim());
    } catch {
      console.error("Failed to parse Claude response:", content.text);
      return NextResponse.json({
        success: false,
        error: "Could not parse instructions from reply",
        rawResponse: content.text,
      });
    }

    // Validate instructions - allow null emailIndex for standalone actions (calendar)
    const validInstructions = parsedInstructions.filter((inst) => {
      // Standalone actions (like calendar bookings) have null emailIndex
      if (inst.emailIndex === null) return true;
      // Email-related actions must reference a valid email
      const index = inst.emailIndex - 1;
      return index >= 0 && index < digestEmails.length;
    });

    // Enrich with email IDs where applicable
    validInstructions.forEach((inst) => {
      if (inst.emailIndex !== null) {
        const email = digestEmails[inst.emailIndex - 1];
        if (email) {
          inst.emailId = email.id;
        }
      }
    });

    // Create actions in the queue
    const createdActions = [];
    for (const instruction of validInstructions) {
      const email = instruction.emailIndex !== null 
        ? digestEmails[instruction.emailIndex - 1] 
        : null;

      try {
        // Determine if action requires approval
        const requiresApproval = ["send_email", "book_meeting"].includes(instruction.actionType);
        
        const action = await createAction({
          user_email: userEmail,
          action_type: instruction.actionType,
          payload: instruction.payload,
          email_id: instruction.emailId || undefined,
          email_subject: email?.subject || (instruction.actionType === "book_meeting" ? "Calendar Booking" : undefined),
          email_from: email?.from || undefined,
          user_instruction: instruction.rawInstruction,
          requires_approval: requiresApproval,
          priority: requiresApproval ? 3 : 5,
        });

        createdActions.push({
          actionId: action.id,
          emailIndex: instruction.emailIndex,
          emailSubject: email?.subject || "Standalone Action",
          actionType: instruction.actionType,
          status: action.status,
          confidence: instruction.confidence,
        });
      } catch (actionError) {
        console.error("Failed to create action:", actionError);
      }
    }

    // Update digest log to mark reply received
    const emailIds = digestEmails.map((e: DigestEmail) => e.id);
    await supabase
      .from("digest_log")
      .update({
        reply_received: true,
        reply_at: new Date().toISOString(),
        reply_content: replyContent,
        actions_taken: createdActions.length,
      })
      .contains("email_ids", emailIds)
      .eq("user_email", userEmail)
      .order("sent_at", { ascending: false })
      .limit(1);

    return NextResponse.json({
      success: true,
      parsed: validInstructions.length,
      actions: createdActions,
      instructions: validInstructions,
    });
  } catch (error) {
    console.error("Error parsing reply:", error);
    return NextResponse.json(
      { error: "Failed to parse reply" },
      { status: 500 }
    );
  }
}
