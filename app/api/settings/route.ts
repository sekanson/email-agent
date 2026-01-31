import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { mergeUserSettingsWithDefaults, type UserSettings } from "@/lib/settings-merge";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to access settings");
    }

    const userEmail = authenticatedEmail; // Use authenticated email

    const supabase = createClient();

    // Get user info including subscription status, draft count, and integrations
    // NOTE: Only select safe columns - never expose tokens or sensitive Stripe data!
    const { data: user, error: userError } = await supabase
      .from("users")
      .select(`
        id, email, name, picture, created_at, updated_at,
        subscription_status, subscription_tier, trial_ends_at,
        drafts_created_count, emails_processed_count,
        onboarding_completed, notification_preferences,
        gmail_connected, gmail_connected_at, calendar_connected, calendar_connected_at,
        labels_created, is_admin, role
      `)
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

    // Use safe merge to ensure all defaults are present while preserving user data
    const mergedSettings = mergeUserSettingsWithDefaults(settings);

    return NextResponse.json({
      user,
      settings: mergedSettings,
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
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to save settings");
    }

    const { settings } = await request.json();
    const userEmail = authenticatedEmail; // Use authenticated email

    const supabase = createClient();

    // Fetch existing settings to merge safely
    let { data: existingSettings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    if (!existingSettings) {
      const result = await supabase
        .from("user_settings")
        .select("*")
        .eq("email", userEmail)
        .single();
      existingSettings = result.data;
    }

    // Start with existing settings, merge with defaults, then apply new settings
    const currentSettings = mergeUserSettingsWithDefaults(existingSettings);
    
    // Apply only the settings that were explicitly provided in the request
    const updatedSettings: UserSettings = { ...currentSettings };
    
    // Update only provided fields (preserves existing user data)
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        (updatedSettings as any)[key] = value;
      }
    }

    // Try with user_email first, then email as fallback
    const tryUpsert = async (emailColumn: string) => {
      const settingsToSave = {
        [emailColumn]: userEmail,
        ...updatedSettings,
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
