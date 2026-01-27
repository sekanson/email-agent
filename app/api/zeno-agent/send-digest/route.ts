import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { sendDigestEmail, DigestEmail } from "@/lib/zeno-mailer";

// Force Node.js runtime (not Edge) for nodemailer compatibility
export const runtime = "nodejs";
import { generateDraftResponse } from "@/lib/claude";

// Generate 2-3 suggested quick replies for an email
async function generateSuggestedReplies(
  from: string,
  subject: string,
  snippet: string,
  category: number
): Promise<string[]> {
  // Only generate suggestions for actionable categories
  if (![1, 5].includes(category)) {
    return [];
  }

  // Simple pattern-based suggestions for common scenarios
  const lowerSubject = subject.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();

  // Meeting/calendar related
  if (category === 5 || lowerSubject.includes("meeting") || lowerSubject.includes("call") || lowerSubject.includes("schedule")) {
    if (lowerSnippet.includes("available") || lowerSnippet.includes("work for you")) {
      return [
        "Yes, that works for me",
        "Can we do 30 minutes later?",
        "Let me check and get back to you",
      ];
    }
    if (lowerSnippet.includes("confirm") || lowerSnippet.includes("reminder")) {
      return [
        "Confirmed, see you then",
        "I need to reschedule",
      ];
    }
  }

  // Question/request patterns
  if (lowerSnippet.includes("?") || lowerSnippet.includes("can you") || lowerSnippet.includes("could you")) {
    return [
      "Yes, I can do that",
      "Let me look into this and get back to you",
      "I'll need more details",
    ];
  }

  // Deadline/urgent patterns
  if (lowerSnippet.includes("deadline") || lowerSnippet.includes("asap") || lowerSnippet.includes("urgent")) {
    return [
      "On it, will have this done",
      "Need a bit more time - can we extend?",
    ];
  }

  // Default professional responses
  return [
    "Thanks, I'll review and respond",
    "Got it, will follow up soon",
  ];
}

// Check if an email is urgent based on various signals
function checkUrgency(
  from: string,
  fromEmail: string,
  subject: string,
  snippet: string,
  vipSenders: string[]
): { isUrgent: boolean; reason?: string } {
  const lowerSubject = subject.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  const lowerFrom = fromEmail.toLowerCase();

  // VIP sender check
  if (vipSenders.some(vip => lowerFrom.includes(vip.toLowerCase()))) {
    return { isUrgent: true, reason: "VIP sender" };
  }

  // Deadline keywords
  const deadlineKeywords = ["urgent", "asap", "immediately", "deadline today", "eod", "end of day", "by tomorrow", "time sensitive"];
  for (const keyword of deadlineKeywords) {
    if (lowerSubject.includes(keyword) || lowerSnippet.includes(keyword)) {
      return { isUrgent: true, reason: "Time sensitive" };
    }
  }

  // Personal/family keywords
  const personalKeywords = ["pick up", "pickup", "school", "doctor", "emergency", "wedding", "rsvp", "funeral", "hospital"];
  for (const keyword of personalKeywords) {
    if (lowerSubject.includes(keyword) || lowerSnippet.includes(keyword)) {
      return { isUrgent: true, reason: "Personal/Family" };
    }
  }

  // Boss/manager keywords in from
  const authorityKeywords = ["ceo", "cto", "cfo", "director", "manager", "boss", "supervisor"];
  for (const keyword of authorityKeywords) {
    if (from.toLowerCase().includes(keyword)) {
      return { isUrgent: true, reason: "From leadership" };
    }
  }

  return { isUrgent: false };
}

export async function POST(request: NextRequest) {
  try {
    const { userEmail, digestType = "morning", forceUrgentOnly = false } = await request.json();

    if (!userEmail) {
      return NextResponse.json({ error: "User email required" }, { status: 400 });
    }

    const supabase = createClient();

    // Get user and their settings
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user settings including VIP senders
    let { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    if (!settings) {
      const result = await supabase
        .from("user_settings")
        .select("*")
        .eq("email", userEmail)
        .single();
      settings = result.data;
    }

    const vipSenders: string[] = settings?.vip_senders || [];
    const focusMode = settings?.focus_mode_enabled || false;
    const focusModeUntil = settings?.focus_mode_until ? new Date(settings.focus_mode_until) : null;

    // Check if in focus mode (skip non-urgent digests)
    const inFocusMode = focusMode && (!focusModeUntil || focusModeUntil > new Date());
    if (inFocusMode && digestType !== "urgent" && !forceUrgentOnly) {
      console.log(`User ${userEmail} is in focus mode, skipping ${digestType} digest`);
      return NextResponse.json({ success: true, skipped: true, reason: "focus_mode" });
    }

    // Get recent emails that need attention
    const timeRange = digestType === "weekly" 
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : digestType === "eod"
      ? new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() // Last 12 hours
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Last 24 hours

    const { data: emails, error: emailsError } = await supabase
      .from("emails")
      .select("*")
      .eq("user_email", userEmail)
      .in("category", [1, 5]) // Reply Needed + Calendar
      .gte("processed_at", timeRange)
      .order("processed_at", { ascending: false })
      .limit(20);

    if (emailsError) {
      console.error("Failed to fetch emails:", emailsError);
      return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
    }

    // Process emails and check urgency
    const needsAttention: DigestEmail["needsAttention"] = [];
    const urgentEmails: DigestEmail["needsAttention"] = [];

    for (const email of emails || []) {
      const urgency = checkUrgency(
        email.from,
        email.from_email || email.from,
        email.subject,
        email.body_preview || "",
        vipSenders
      );

      const suggestedReplies = await generateSuggestedReplies(
        email.from,
        email.subject,
        email.body_preview || "",
        email.category
      );

      const emailData = {
        id: email.gmail_id,
        from: email.from,
        fromEmail: email.from_email || email.from,
        subject: email.subject,
        snippet: email.body_preview,
        category: email.category,
        urgencyReason: urgency.reason,
        suggestedReplies,
      };

      if (urgency.isUrgent) {
        urgentEmails.push(emailData);
      }
      needsAttention.push(emailData);
    }

    // If urgent-only mode or focus mode, only send if there are urgent emails
    if ((forceUrgentOnly || inFocusMode) && urgentEmails.length === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: "no_urgent_emails" });
    }

    // Get summary stats
    const { data: allEmails } = await supabase
      .from("emails")
      .select("category")
      .eq("user_email", userEmail)
      .gte("processed_at", timeRange);

    const byCategory: Record<number, number> = {};
    let draftsCreated = 0;
    for (const e of allEmails || []) {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
      if (e.category === 1) draftsCreated++;
    }

    // Build and send the digest
    const digestData: DigestEmail = {
      to: userEmail,
      userName: user.name || userEmail.split("@")[0],
      digestType: (forceUrgentOnly || inFocusMode) ? "urgent" : digestType,
      needsAttention: (forceUrgentOnly || inFocusMode) ? urgentEmails : needsAttention,
      summary: {
        totalProcessed: allEmails?.length || 0,
        byCategory,
        draftsCreated,
      },
    };

    const result = await sendDigestEmail(digestData);

    if (result.success) {
      // Log the digest send
      await supabase.from("zeno_digest_logs").insert({
        user_email: userEmail,
        digest_type: digestData.digestType,
        emails_included: digestData.needsAttention.length,
        sent_at: new Date().toISOString(),
        message_id: result.messageId,
      }).catch(() => {}); // Ignore if table doesn't exist yet
    }

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      emailsIncluded: digestData.needsAttention.length,
      urgentCount: urgentEmails.length,
      error: result.error,
    });

  } catch (error: any) {
    console.error("Failed to send digest:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
