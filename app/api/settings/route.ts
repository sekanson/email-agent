import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

const DEFAULT_CATEGORIES = {
  "1": { name: "To Respond", color: "#ef4444", enabled: true },
  "2": { name: "FYI", color: "#f59e0b", enabled: true },
  "3": { name: "Comment", color: "#10b981", enabled: true },
  "4": { name: "Notification", color: "#6366f1", enabled: true },
  "5": { name: "Meeting Update", color: "#8b5cf6", enabled: true },
  "6": { name: "Awaiting Reply", color: "#06b6d4", enabled: true },
  "7": { name: "Actioned", color: "#84cc16", enabled: true },
  "8": { name: "Marketing", color: "#f97316", enabled: true },
};

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

    // Get user info including subscription status, draft count, and integrations
    // Note: gmail_connected, calendar_connected may not exist in all deployments
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    // If specific columns are missing, they'll just be undefined which is fine
    if (userError) {
      console.error("Error fetching user:", userError);
    }

    // Get user settings - try user_email first, then email
    let { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    // If no result, try with email column
    if (!settings) {
      const result = await supabase
        .from("user_settings")
        .select("*")
        .eq("email", userEmail)
        .single();
      settings = result.data;
    }

    // Return defaults if no settings exist
    if (!settings) {
      return NextResponse.json({
        user,
        settings: {
          temperature: 0.7,
          signature: "",
          drafts_enabled: true,
          auto_poll_enabled: false,
          auto_poll_interval: 120,
          categories: DEFAULT_CATEGORIES,
          use_writing_style: false,
          writing_style: "",
        },
      });
    }

    return NextResponse.json({
      user,
      settings,
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userEmail, settings } = await request.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Build base settings object (user_id omitted - FK constraint references profiles table not users)
    const baseSettings: Record<string, unknown> = {
      temperature: settings.temperature ?? 0.7,
      signature: settings.signature ?? "",
      drafts_enabled: settings.drafts_enabled ?? true,
      categories: settings.categories ?? DEFAULT_CATEGORIES,
      auto_poll_enabled: settings.auto_poll_enabled,
      auto_poll_interval: settings.auto_poll_interval,
      use_writing_style: settings.use_writing_style ?? false,
      writing_style: settings.writing_style ?? "",
    };

    // Try with user_email first, then email as fallback
    const tryUpsert = async (emailColumn: string) => {
      const settingsToSave = {
        [emailColumn]: userEmail,
        ...baseSettings,
      };

      return await supabase
        .from("user_settings")
        .upsert(settingsToSave, { onConflict: emailColumn })
        .select()
        .single();
    };

    // First try with user_email
    let { data, error } = await tryUpsert("user_email");

    // If user_email column doesn't exist, try with just email
    if (error?.message?.includes("user_email")) {
      console.log("Retrying with 'email' column...");
      const result = await tryUpsert("email");
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error saving settings:", error);
      return NextResponse.json(
        { error: `Failed to save settings: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: data,
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
