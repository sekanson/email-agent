import { NextRequest, NextResponse } from "next/server";
import { applyLabel, getLabels, refreshAccessToken } from "@/lib/gmail";
import { createClient } from "@/lib/supabase";

// Debug endpoint to diagnose label issues
// GET: Show current label mapping and Gmail labels
// POST: Test applying a label to a specific email
export async function GET(request: NextRequest) {
  const userEmail = request.nextUrl.searchParams.get("email");

  if (!userEmail) {
    return NextResponse.json({ error: "email parameter required" }, { status: 400 });
  }

  const supabase = createClient();

  const { data: user } = await supabase
    .from("users")
    .select("gmail_label_ids, labels_created, refresh_token, access_token")
    .eq("email", userEmail)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get user settings for categories
  let { data: settings } = await supabase
    .from("user_settings")
    .select("categories, our_label_ids")
    .eq("user_email", userEmail)
    .single();

  if (!settings) {
    const result = await supabase
      .from("user_settings")
      .select("categories, our_label_ids")
      .eq("email", userEmail)
      .single();
    settings = result.data;
  }

  // Refresh token and get actual Gmail labels
  let gmailLabels = null;
  try {
    const accessToken = await refreshAccessToken(user.refresh_token);
    gmailLabels = await getLabels(accessToken, user.refresh_token);
  } catch (e) {
    console.error("Failed to fetch Gmail labels:", e);
  }

  // Get some processed emails from DB
  const { data: recentEmails } = await supabase
    .from("emails")
    .select("gmail_id, subject, category, processed_at")
    .eq("user_email", userEmail)
    .order("processed_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    user: {
      email: userEmail,
      labels_created: user.labels_created,
      gmail_label_ids: user.gmail_label_ids,
    },
    settings: {
      categories: settings?.categories ? Object.fromEntries(
        Object.entries(settings.categories).map(([k, v]: [string, any]) => [k, { name: v.name, enabled: v.enabled }])
      ) : null,
      our_label_ids: settings?.our_label_ids,
    },
    gmail: {
      labels: gmailLabels?.filter(l =>
        !l.name.startsWith("CATEGORY_") &&
        !["INBOX", "SENT", "TRASH", "DRAFT", "SPAM", "STARRED", "IMPORTANT", "UNREAD"].includes(l.name)
      ).slice(0, 20),
    },
    recentProcessedEmails: recentEmails,
    diagnosis: {
      hasGmailLabelIds: !!user.gmail_label_ids && Object.keys(user.gmail_label_ids).length > 0,
      labelIdCount: user.gmail_label_ids ? Object.keys(user.gmail_label_ids).length : 0,
      labelsMatch: user.gmail_label_ids && gmailLabels ?
        Object.values(user.gmail_label_ids as Record<string, string>).every(id =>
          gmailLabels.some(l => l.id === id)
        ) : false,
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userEmail, emailId, labelId } = await request.json();

    if (!userEmail || !emailId || !labelId) {
      return NextResponse.json(
        { error: "userEmail, emailId, and labelId required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: user } = await supabase
      .from("users")
      .select("refresh_token, access_token")
      .eq("email", userEmail)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const accessToken = await refreshAccessToken(user.refresh_token);

    await applyLabel(accessToken, user.refresh_token, emailId, labelId);

    return NextResponse.json({
      success: true,
      message: `Applied label ${labelId} to email ${emailId}`,
    });
  } catch (error: any) {
    console.error("Debug label apply failed:", error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
