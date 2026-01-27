import { NextRequest, NextResponse } from "next/server";
import { testConnection, sendDigestEmail } from "@/lib/zeno-mailer";

// Force Node.js runtime (not Edge) for nodemailer compatibility
export const runtime = "nodejs";

// Test endpoint to verify SMTP and send a test digest
export async function POST(request: NextRequest) {
  try {
    const { userEmail, action = "test-connection" } = await request.json();

    if (action === "test-connection") {
      const connected = await testConnection();
      return NextResponse.json({ 
        success: connected, 
        message: connected ? "SMTP connection verified!" : "SMTP connection failed" 
      });
    }

    if (action === "test-digest" && userEmail) {
      const result = await sendDigestEmail({
        to: userEmail,
        userName: userEmail.split("@")[0],
        digestType: "morning",
        needsAttention: [
          {
            id: "test-1",
            from: "Sarah Chen <sarah@acme.com>",
            fromEmail: "sarah@acme.com",
            subject: "Q4 Contract Review - Need Your Sign-off",
            snippet: "Hi, just following up on the contract we discussed. Can you review and confirm by EOD tomorrow?",
            category: 1,
            urgencyReason: "Time sensitive",
            suggestedReplies: [
              "Looks good, approved",
              "Need a few changes, let's discuss",
              "Will review by tomorrow"
            ],
          },
          {
            id: "test-2",
            from: "Aamir <aamir@xix3d.com>",
            fromEmail: "aamir@xix3d.com",
            subject: "Meeting Tomorrow?",
            snippet: "Hey, are we still on for the 2pm sync tomorrow? Let me know if the time still works.",
            category: 5,
            suggestedReplies: [
              "Yes, confirmed",
              "Can we push to 3pm?",
              "Need to reschedule"
            ],
          },
        ],
        summary: {
          totalProcessed: 12,
          byCategory: { 1: 2, 2: 4, 3: 1, 4: 3, 5: 1, 8: 1 },
          draftsCreated: 2,
        },
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Test endpoint error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  // Quick health check
  const connected = await testConnection();
  return NextResponse.json({ 
    status: connected ? "healthy" : "smtp_error",
    smtp: connected 
  });
}
