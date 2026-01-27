import { NextRequest, NextResponse } from "next/server";
import { fetchUnreadReplies, markAsRead } from "@/lib/zeno-inbox";
import { createClient } from "@/lib/supabase";
import { createDraft } from "@/lib/gmail";
import { sendActionConfirmation } from "@/lib/zeno-mailer";
import Anthropic from "@anthropic-ai/sdk";

// Force Node.js runtime (not Edge) for IMAP/nodemailer compatibility
export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ParsedAction {
  type: "reply" | "draft" | "send" | "schedule" | "unknown";
  targetEmail?: string;
  targetName?: string;
  message?: string;
  replyNumber?: number;
  confidence: number;
  rawIntent: string;
}

// Parse user's reply intent using Claude
async function parseIntent(
  userReply: string,
  recentEmails: any[],
  knownContacts: { name: string; email: string }[]
): Promise<ParsedAction[]> {
  
  const recentContext = recentEmails
    .slice(0, 10)
    .map((e, i) => `${i + 1}. From: ${e.from} (${e.from_email}), Subject: "${e.subject}"`)
    .join("\n");

  const contactsContext = knownContacts
    .slice(0, 50)
    .map(c => `${c.name}: ${c.email}`)
    .join("\n");

  const prompt = `Parse this email reply into actionable commands.

RECENT EMAILS (for "Reply 1/2/3" references):
${recentContext || "None"}

KNOWN CONTACTS:
${contactsContext || "None"}

USER'S REPLY:
"${userReply}"

Parse into JSON actions:
{
  "actions": [
    {
      "type": "reply|draft|send|schedule",
      "targetEmail": "email@example.com",
      "targetName": "Name",
      "message": "content to send",
      "replyNumber": 1,
      "confidence": 0.95,
      "rawIntent": "what user wanted"
    }
  ]
}

Rules:
- "Reply 1 with X" → reply to numbered email with message X
- "Tell/Email X that Y" → send message Y to contact X  
- "Draft reply to X saying Y" → create draft to X with message Y
- "Schedule meeting with X" → meeting request
- Match names to known contacts
- Multiple commands = multiple actions

Return ONLY valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Bad response");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.actions || [];

  } catch (error) {
    console.error("Parse error:", error);
    return [{ type: "unknown", confidence: 0, rawIntent: userReply }];
  }
}

// Execute a single action
async function executeAction(
  action: ParsedAction,
  user: any,
  recentEmails: any[]
): Promise<{ success: boolean; result: string }> {
  
  if (action.type === "reply" && action.replyNumber) {
    const target = recentEmails[action.replyNumber - 1];
    if (!target) return { success: false, result: `Email #${action.replyNumber} not found` };

    try {
      await createDraft(
        user.access_token,
        user.refresh_token,
        target.from_email,
        target.subject,
        action.message || "",
        target.thread_id || target.gmail_id,
        undefined,
        user.email
      );
      return { success: true, result: `✅ Draft created replying to ${target.from}: "${action.message?.slice(0, 50)}..."` };
    } catch (e: any) {
      return { success: false, result: `Failed: ${e.message}` };
    }
  }

  if ((action.type === "draft" || action.type === "send") && action.targetEmail) {
    try {
      const existing = recentEmails.find(e => 
        e.from_email?.toLowerCase() === action.targetEmail?.toLowerCase()
      );

      await createDraft(
        user.access_token,
        user.refresh_token,
        action.targetEmail,
        existing?.subject || `Message for ${action.targetName || "you"}`,
        action.message || "",
        existing?.thread_id || "",
        undefined,
        user.email
      );
      return { success: true, result: `✅ Draft created to ${action.targetName || action.targetEmail}: "${action.message?.slice(0, 50)}..."` };
    } catch (e: any) {
      return { success: false, result: `Failed: ${e.message}` };
    }
  }

  if (action.type === "schedule") {
    return { 
      success: false, 
      result: `📅 Meeting scheduling coming soon! For now, I've noted: "${action.rawIntent}"` 
    };
  }

  return { 
    success: false, 
    result: `❓ Couldn't understand: "${action.rawIntent}". Try "Reply 1 with: message" or "Tell [name] that [message]"` 
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 Polling for replies...");
    
    // Fetch unread replies from Zeno's inbox
    const replies = await fetchUnreadReplies();
    console.log(`Found ${replies.length} unread replies`);

    if (replies.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const supabase = createClient();
    const results: any[] = [];

    for (const reply of replies) {
      try {
        console.log(`Processing reply from ${reply.fromEmail}: "${reply.body.slice(0, 100)}..."`);

        // Get user by email
        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("email", reply.fromEmail)
          .single();

        if (!user) {
          console.log(`User not found: ${reply.fromEmail}`);
          continue;
        }

        // Get user's recent emails for context
        const { data: recentEmails } = await supabase
          .from("emails")
          .select("*")
          .eq("user_email", reply.fromEmail)
          .order("processed_at", { ascending: false })
          .limit(20);

        // Get known contacts
        const { data: contacts } = await supabase
          .from("emails")
          .select("from, from_email")
          .eq("user_email", reply.fromEmail)
          .limit(100);

        const uniqueContacts = new Map<string, { name: string; email: string }>();
        for (const c of contacts || []) {
          const email = c.from_email?.toLowerCase();
          if (email && !uniqueContacts.has(email)) {
            const nameMatch = c.from?.match(/^([^<]+)</);
            uniqueContacts.set(email, { 
              name: nameMatch ? nameMatch[1].trim() : email.split("@")[0], 
              email 
            });
          }
        }

        // Parse the intent
        const actions = await parseIntent(
          reply.body,
          recentEmails || [],
          Array.from(uniqueContacts.values())
        );

        console.log("Parsed actions:", actions);

        // Execute each action
        const actionResults: string[] = [];
        for (const action of actions) {
          if (action.confidence < 0.4) {
            actionResults.push(`⚠️ Low confidence: "${action.rawIntent}"`);
            continue;
          }
          const result = await executeAction(action, user, recentEmails || []);
          actionResults.push(result.result);
        }

        // Send confirmation back to user
        await sendActionConfirmation({
          to: reply.fromEmail,
          userName: user.name || reply.fromEmail.split("@")[0],
          action: `${actions.length} action(s) processed`,
          result: actionResults.join("\n\n"),
          originalRequest: reply.body,
        });

        // Mark the reply as read
        await markAsRead(reply.messageId);

        results.push({
          from: reply.fromEmail,
          actions: actions.length,
          results: actionResults,
        });

      } catch (replyError: any) {
        console.error(`Failed to process reply from ${reply.fromEmail}:`, replyError);
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });

  } catch (error: any) {
    console.error("Poll replies error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also support GET for easy cron triggering
export async function GET() {
  return POST(new Request("http://localhost", { method: "POST" }) as NextRequest);
}
