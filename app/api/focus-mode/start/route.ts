import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { 
  refreshAccessToken, 
  createLabel, 
  getLabels,
  createFilter,
  getFilters
} from "@/lib/gmail";

const FOCUS_QUEUE_LABEL = "📵 Focus Queue";

export async function POST(request: NextRequest) {
  try {
    const { userEmail, durationHours } = await request.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
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

    // Refresh token
    let accessToken = user.access_token;
    try {
      accessToken = await refreshAccessToken(user.refresh_token);
      await supabase
        .from("users")
        .update({ access_token: accessToken })
        .eq("email", userEmail);
    } catch (e) {
      console.error("Token refresh failed:", e);
    }

    // Step 1: Create or get Focus Queue label
    let focusLabelId: string | null = null;
    const labels = await getLabels(accessToken, user.refresh_token);
    const existingLabel = labels.find(l => l.name === FOCUS_QUEUE_LABEL);
    
    if (existingLabel) {
      focusLabelId = existingLabel.id;
    } else {
      const newLabel = await createLabel(accessToken, user.refresh_token, FOCUS_QUEUE_LABEL, "#9E9E9E");
      focusLabelId = newLabel.id;
    }

    // Step 2: Check if focus filter already exists
    const filters = await getFilters(accessToken, user.refresh_token);
    const existingFilter = filters.find(f => 
      f.criteria?.query === "-from:me" && 
      f.action?.removeLabelIds?.includes("INBOX")
    );

    if (existingFilter) {
      return NextResponse.json({
        success: true,
        message: "Focus mode already active",
        filterId: existingFilter.id,
        labelId: focusLabelId,
        alreadyActive: true,
      });
    }

    // Step 3: Create filter to skip inbox and add Focus Queue label
    const filter = await createFilter(accessToken, user.refresh_token, {
      criteria: {
        query: "-from:me", // All emails not from myself
      },
      action: {
        removeLabelIds: ["INBOX"], // Skip inbox
        addLabelIds: [focusLabelId], // Add to Focus Queue
      },
    });

    // Step 4: Calculate end time and save to user settings
    const startTime = new Date();
    const endTime = durationHours 
      ? new Date(startTime.getTime() + durationHours * 60 * 60 * 1000)
      : null;

    // Update user settings
    const { error: settingsError } = await supabase
      .from("user_settings")
      .upsert({
        user_email: userEmail,
        focus_mode_enabled: true,
        focus_mode_until: endTime?.toISOString() || null,
        focus_mode_filter_id: filter.id,
        focus_mode_label_id: focusLabelId,
        focus_mode_started_at: startTime.toISOString(),
      }, { onConflict: "user_email" });

    if (settingsError) {
      console.error("Failed to save focus mode settings:", settingsError);
    }

    return NextResponse.json({
      success: true,
      message: `Focus mode enabled${durationHours ? ` for ${durationHours} hours` : ''}`,
      filterId: filter.id,
      labelId: focusLabelId,
      startTime: startTime.toISOString(),
      endTime: endTime?.toISOString() || null,
    });

  } catch (error: any) {
    console.error("Error starting focus mode:", error);
    return NextResponse.json(
      { error: `Failed to start focus mode: ${error.message}` },
      { status: 500 }
    );
  }
}
