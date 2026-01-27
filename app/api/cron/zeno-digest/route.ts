import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { sendDigestEmail, DigestEmail } from "@/lib/zeno-mailer";

// Force Node.js runtime (not Edge) for nodemailer compatibility
export const runtime = "nodejs";

// Cron endpoint to send digests to all users
// Called by Vercel cron: /api/cron/zeno-digest?type=morning|eod|weekly

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const digestType = (searchParams.get("type") || "morning") as "morning" | "eod" | "weekly" | "urgent";

    console.log(`🕐 Running ${digestType} digest cron...`);

    const supabase = createClient();

    // Get all users with Zeno digest enabled
    // For now, get all active users - we can add settings later
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("email, name")
      .eq("labels_created", true); // Only users who have set up the system

    if (usersError) {
      console.error("Failed to fetch users:", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    console.log(`Found ${users?.length || 0} users to send digests to`);

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const user of users || []) {
      try {
        // Get user's settings to check if digest is enabled
        let { data: settings } = await supabase
          .from("user_settings")
          .select("zeno_digest_enabled, zeno_digest_types, focus_mode_enabled, focus_mode_until")
          .eq("user_email", user.email)
          .single();

        if (!settings) {
          const result = await supabase
            .from("user_settings")
            .select("zeno_digest_enabled, zeno_digest_types, focus_mode_enabled, focus_mode_until")
            .eq("email", user.email)
            .single();
          settings = result.data;
        }

        // Check if user has digest enabled (default to true for now)
        const digestEnabled = settings?.zeno_digest_enabled !== false;
        const enabledTypes = settings?.zeno_digest_types || ["morning", "eod", "weekly"];
        
        if (!digestEnabled || !enabledTypes.includes(digestType)) {
          console.log(`Skipping ${user.email} - digest not enabled`);
          continue;
        }

        // Check focus mode
        const inFocusMode = settings?.focus_mode_enabled && 
          (!settings?.focus_mode_until || new Date(settings.focus_mode_until) > new Date());
        
        if (inFocusMode && digestType !== "urgent") {
          console.log(`Skipping ${user.email} - focus mode active`);
          continue;
        }

        // Get emails needing attention
        const timeRange = digestType === "weekly" 
          ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: emails } = await supabase
          .from("emails")
          .select("*")
          .eq("user_email", user.email)
          .in("category", [1, 5]) // Reply Needed + Calendar
          .gte("processed_at", timeRange)
          .order("processed_at", { ascending: false })
          .limit(10);

        // Build digest data
        const needsAttention = (emails || []).map(email => ({
          id: email.gmail_id,
          from: email.from,
          fromEmail: email.from_email || email.from,
          subject: email.subject,
          snippet: email.body_preview,
          category: email.category,
          suggestedReplies: generateSuggestions(email),
        }));

        // Get summary stats
        const { data: allEmails } = await supabase
          .from("emails")
          .select("category, draft_id")
          .eq("user_email", user.email)
          .gte("processed_at", timeRange);

        const byCategory: Record<number, number> = {};
        let draftsCreated = 0;
        for (const e of allEmails || []) {
          byCategory[e.category] = (byCategory[e.category] || 0) + 1;
          if (e.draft_id) draftsCreated++;
        }

        // Send digest
        const result = await sendDigestEmail({
          to: user.email,
          userName: user.name || user.email.split("@")[0],
          digestType,
          needsAttention,
          summary: {
            totalProcessed: allEmails?.length || 0,
            byCategory,
            draftsCreated,
          },
        });

        results.push({
          email: user.email,
          success: result.success,
          error: result.error,
        });

        console.log(`${result.success ? "✅" : "❌"} Sent ${digestType} digest to ${user.email}`);

      } catch (userError: any) {
        console.error(`Failed to send digest to ${user.email}:`, userError);
        results.push({
          email: user.email,
          success: false,
          error: userError.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ ${digestType} digest cron complete: ${successCount}/${results.length} sent`);

    return NextResponse.json({
      success: true,
      digestType,
      sent: successCount,
      total: results.length,
      results,
    });

  } catch (error: any) {
    console.error("Digest cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Generate contextual suggestions for an email
function generateSuggestions(email: any): string[] {
  const suggestions: string[] = [];
  const lowerSubject = email.subject?.toLowerCase() || "";
  const lowerBody = email.body_preview?.toLowerCase() || "";

  // Meeting-related
  if (email.category === 5 || lowerSubject.includes("meeting") || lowerSubject.includes("call")) {
    if (lowerBody.includes("confirm") || lowerBody.includes("still on")) {
      suggestions.push("Yes, confirmed");
      suggestions.push("Need to reschedule");
    } else {
      suggestions.push("That works for me");
      suggestions.push("Can we do a different time?");
    }
  }
  // Question/action required
  else if (lowerBody.includes("?") || email.category === 1) {
    suggestions.push("Sounds good, let's proceed");
    suggestions.push("I'll review and get back to you");
    suggestions.push("Need more information");
  }
  // Default
  else {
    suggestions.push("Thanks, noted");
    suggestions.push("Will follow up");
  }

  return suggestions.slice(0, 2);
}
