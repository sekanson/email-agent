import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

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

    // First, fetch existing settings to merge with (prevents overwriting unrelated fields)
    let existingSettings: Record<string, unknown> = {};
    let { data: existing } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    if (!existing) {
      const result = await supabase
        .from("user_settings")
        .select("*")
        .eq("email", userEmail)
        .single();
      existing = result.data;
    }

    if (existing) {
      existingSettings = existing;
    }

    // Build base settings object by merging existing with new values
    // Only override fields that are explicitly provided in the request
    const baseSettings: Record<string, unknown> = {
      // Draft generation settings
      temperature: settings.temperature ?? existingSettings.temperature ?? 0.7,
      signature: settings.signature ?? existingSettings.signature ?? "",
      drafts_enabled: settings.drafts_enabled ?? existingSettings.drafts_enabled ?? true,
      categories: settings.categories ?? existingSettings.categories ?? DEFAULT_CATEGORIES,
      auto_poll_enabled: settings.auto_poll_enabled ?? existingSettings.auto_poll_enabled,
      auto_poll_interval: settings.auto_poll_interval ?? existingSettings.auto_poll_interval,
      use_writing_style: settings.use_writing_style ?? existingSettings.use_writing_style ?? false,
      writing_style: settings.writing_style ?? existingSettings.writing_style ?? "",
      // Zeno assistant settings
      zeno_digest_enabled: settings.zeno_digest_enabled ?? existingSettings.zeno_digest_enabled ?? true,
      zeno_digest_types: settings.zeno_digest_types ?? existingSettings.zeno_digest_types ?? ["morning", "eod", "weekly"],
      zeno_morning_time: settings.zeno_morning_time ?? existingSettings.zeno_morning_time ?? "09:00",
      zeno_eod_time: settings.zeno_eod_time ?? existingSettings.zeno_eod_time ?? "18:00",
      vip_senders: settings.vip_senders ?? existingSettings.vip_senders ?? [],
      focus_mode_enabled: settings.focus_mode_enabled ?? existingSettings.focus_mode_enabled ?? false,
      focus_mode_until: settings.focus_mode_until ?? existingSettings.focus_mode_until ?? null,
      timezone: settings.timezone ?? existingSettings.timezone ?? "America/New_York",
      zeno_confirmations: settings.zeno_confirmations ?? existingSettings.zeno_confirmations ?? true,
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
