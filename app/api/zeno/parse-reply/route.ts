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
  emailIndex: number;
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
    const prompt = `You are parsing a user's reply to an email digest. Extract the action instructions for each email mentioned.

DIGEST EMAILS:
${emailContext}

USER'S REPLY:
${replyContent}

Parse the user's instructions and return a JSON array of actions. Each action should have:
- emailIndex: which email (1-indexed, matching the digest)
- actionType: one of "draft_reply", "send_email", "book_meeting", "accept_meeting", "decline_meeting", "follow_up", "archive", "forward"
- payload: relevant details extracted from the instruction
- rawInstruction: the original instruction text
- confidence: 0.0 to 1.0

Examples of how to parse:
- "#1: draft a polite decline" → actionType: "draft_reply", payload: { tone: "polite", points_to_address: ["decline"] }
- "#2: accept" → actionType: "accept_meeting"
- "#3: book a call for next Tuesday at 2pm" → actionType: "book_meeting", payload: { proposed_times: ["next Tuesday at 2pm"] }
- "#1: say I'll get back to them next week" → actionType: "draft_reply", payload: { points_to_address: ["will get back next week"] }

Respond with ONLY valid JSON, no markdown, no explanation:
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

    // Validate and enrich with email IDs
    const validInstructions = parsedInstructions.filter((inst) => {
      const index = inst.emailIndex - 1; // Convert to 0-indexed
      return index >= 0 && index < digestEmails.length;
    });

    // Map email IDs
    validInstructions.forEach((inst) => {
      const email = digestEmails[inst.emailIndex - 1];
      if (email) {
        inst.emailId = email.id;
      }
    });

    // Create actions in the queue
    const createdActions = [];
    for (const instruction of validInstructions) {
      const email = digestEmails[instruction.emailIndex - 1];
      
      if (!email) continue;

      try {
        const action = await createAction({
          user_email: userEmail,
          action_type: instruction.actionType,
          payload: instruction.payload,
          email_id: instruction.emailId,
          email_subject: email.subject,
          email_from: email.from,
          user_instruction: instruction.rawInstruction,
          requires_approval: instruction.actionType === "send_email", // Auto-approve drafts
          priority: instruction.actionType === "send_email" ? 3 : 5,
        });

        createdActions.push({
          actionId: action.id,
          emailIndex: instruction.emailIndex,
          emailSubject: email.subject,
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
