import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { cookies } from "next/headers";

/**
 * POST /api/user/preferences
 * Update user notification preferences (timezone, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const { timezone, quiet_hours_start, quiet_hours_end } = await request.json();

    // Get user email from cookie/session
    const cookieStore = await cookies();
    const userEmail = cookieStore.get("user_email")?.value;

    if (!userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createClient();

    // Get current preferences
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("notification_preferences")
      .eq("email", userEmail)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Merge with existing preferences
    const currentPrefs = user.notification_preferences || {};
    const updatedPrefs = {
      ...currentPrefs,
      ...(timezone && { timezone }),
      ...(quiet_hours_start && { quiet_hours_start }),
      ...(quiet_hours_end && { quiet_hours_end }),
    };

    // Update preferences
    const { error: updateError } = await supabase
      .from("users")
      .update({ notification_preferences: updatedPrefs })
      .eq("email", userEmail);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      preferences: updatedPrefs,
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/preferences
 * Get user notification preferences
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get("user_email")?.value;

    if (!userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createClient();

    const { data: user, error } = await supabase
      .from("users")
      .select("notification_preferences")
      .eq("email", userEmail)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      preferences: user.notification_preferences || {},
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}
