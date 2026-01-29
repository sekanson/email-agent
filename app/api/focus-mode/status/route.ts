import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get user settings
    let { data: settings } = await supabase
      .from("user_settings")
      .select("focus_mode_enabled, focus_mode_until, focus_mode_started_at, focus_mode_filter_id")
      .eq("user_email", userEmail)
      .single();

    if (!settings) {
      const result = await supabase
        .from("user_settings")
        .select("focus_mode_enabled, focus_mode_until, focus_mode_started_at, focus_mode_filter_id")
        .eq("email", userEmail)
        .single();
      settings = result.data;
    }

    const isActive = settings?.focus_mode_enabled || false;
    const endTime = settings?.focus_mode_until ? new Date(settings.focus_mode_until) : null;
    const startTime = settings?.focus_mode_started_at ? new Date(settings.focus_mode_started_at) : null;
    
    // Check if focus mode should auto-end
    const shouldAutoEnd = isActive && endTime && new Date() > endTime;

    // Calculate time remaining
    let timeRemainingMs = null;
    let timeRemainingFormatted = null;
    if (isActive && endTime && !shouldAutoEnd) {
      timeRemainingMs = endTime.getTime() - Date.now();
      const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
      timeRemainingFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    return NextResponse.json({
      isActive: isActive && !shouldAutoEnd,
      shouldAutoEnd,
      startTime: startTime?.toISOString() || null,
      endTime: endTime?.toISOString() || null,
      timeRemainingMs,
      timeRemainingFormatted,
      filterId: settings?.focus_mode_filter_id || null,
      indefinite: isActive && !endTime,
    });

  } catch (error: any) {
    console.error("Error checking focus mode status:", error);
    return NextResponse.json(
      { error: `Failed to check focus mode: ${error.message}` },
      { status: 500 }
    );
  }
}
