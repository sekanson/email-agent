import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/gmail";
import { createClient } from "@/lib/supabase";
import {
  DigestEmail,
  generateDigestEmail,
  generateUrgentNotification,
} from "@/lib/zeno-digest";

/**
 * POST /api/zeno/digest
 * 
 * Sends a digest email to the user with important emails.
 * Can send either a full digest or urgent single-email notification.
 * 
 * Body: { 
 *   userEmail: string, 
 *   emails: DigestEmail[], 
 *   type?: 'daily' | 'realtime',
 *   urgentEmailId?: string  // For single urgent email notifications
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const {
      userEmail,
      emails,
      type = "daily",
      urgentEmailId,
    } = await request.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json(
        { error: "No emails to send digest for" },
        { status: 400 }
      );
    }

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

    // Check notification preferences
    const prefs = user.notification_preferences || {};
    
    // Check quiet hours
    if (prefs.quiet_hours_start && prefs.quiet_hours_end) {
      const now = new Date();
      const userTimezone = prefs.timezone || "America/New_York";
      const userTime = new Date(
        now.toLocaleString("en-US", { timeZone: userTimezone })
      );
      const hour = userTime.getHours();
      
      const [quietStart] = (prefs.quiet_hours_start || "22:00").split(":").map(Number);
      const [quietEnd] = (prefs.quiet_hours_end || "07:00").split(":").map(Number);
      
      // Check if in quiet hours (handles overnight quiet hours)
      const inQuietHours = quietStart > quietEnd
        ? hour >= quietStart || hour < quietEnd
        : hour >= quietStart && hour < quietEnd;
      
      if (inQuietHours && type !== "realtime") {
        return NextResponse.json({
          success: false,
          reason: "quiet_hours",
          message: "Currently in quiet hours, digest not sent",
        });
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.com";

    let emailContent;
    let digestType: "daily" | "realtime" | "weekly" = "daily";

    if (urgentEmailId && type === "realtime") {
      // Send urgent single-email notification
      const urgentEmail = emails.find((e: DigestEmail) => e.id === urgentEmailId);
      if (!urgentEmail) {
        return NextResponse.json(
          { error: "Urgent email not found in provided list" },
          { status: 400 }
        );
      }

      emailContent = generateUrgentNotification(urgentEmail, {
        userName: user.name || userEmail,
        userEmail,
        appUrl,
      });
      digestType = "realtime";
    } else {
      // Send full digest
      emailContent = generateDigestEmail(emails, {
        userName: user.name || userEmail,
        userEmail,
        appUrl,
        maxEmails: 10,
      });
    }

    // Send the email to the user (from themselves)
    await sendEmail(
      user.access_token,
      user.refresh_token,
      userEmail, // Send to self
      emailContent.subject,
      emailContent.html // Send HTML version
    );

    // Log the digest
    const emailIds = emails.map((e: DigestEmail) => e.id);
    const respondCount = emails.filter(
      (e: DigestEmail) => e.classification.category === 1
    ).length;
    const calendarCount = emails.filter(
      (e: DigestEmail) => e.classification.category === 5
    ).length;

    await supabase.from("digest_log").insert({
      user_email: userEmail,
      digest_type: digestType,
      email_ids: emailIds,
      email_count: emails.length,
      respond_count: respondCount,
      calendar_count: calendarCount,
      other_count: emails.length - respondCount - calendarCount,
    });

    return NextResponse.json({
      success: true,
      digestType,
      emailsSent: emails.length,
      subject: emailContent.subject,
    });
  } catch (error) {
    console.error("Error sending digest:", error);
    return NextResponse.json(
      { error: "Failed to send digest" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/zeno/digest
 * 
 * Get digest history for a user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: digests, error } = await supabase
      .from("digest_log")
      .select("*")
      .eq("user_email", userEmail)
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      digests: digests || [],
    });
  } catch (error) {
    console.error("Error fetching digest history:", error);
    return NextResponse.json(
      { error: "Failed to fetch digest history" },
      { status: 500 }
    );
  }
}
