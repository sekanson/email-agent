import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { CURRENT_SCHEMA_VERSIONS, type SchemaKey } from "@/lib/schema-versions";
import { DEFAULT_USER_SETTINGS } from "@/lib/settings-merge";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to reset settings");
    }

    const { schema } = await request.json();
    const userEmail = authenticatedEmail; // Use authenticated email

    const supabase = createClient();

    // Get current user settings
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

    let updatedSettings = { ...existingSettings };

    if (schema) {
      // Reset specific schema to current defaults
      switch (schema as SchemaKey) {
        case 'categories':
          updatedSettings.categories = DEFAULT_USER_SETTINGS.categories;
          updatedSettings.schemaVersions = {
            ...updatedSettings.schemaVersions,
            categories: CURRENT_SCHEMA_VERSIONS.categories,
          };
          break;
        // Add more cases for other schemas in the future
        default:
          return NextResponse.json(
            { error: "Unknown schema type" },
            { status: 400 }
          );
      }
    } else {
      // Reset all settings to current defaults
      updatedSettings = {
        ...DEFAULT_USER_SETTINGS,
        // Preserve email identifier
        user_email: existingSettings?.user_email,
        email: existingSettings?.email,
      };
    }

    // Save to database
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

    // Try with user_email first, then email as fallback
    let { data, error } = await tryUpsert("user_email");

    if (error?.message?.includes("user_email")) {
      console.log("Retrying with 'email' column...");
      const result = await tryUpsert("email");
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error resetting settings:", error);
      return NextResponse.json(
        { error: `Failed to reset settings: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      resetSchema: schema || "all",
      settings: data,
    });

  } catch (error) {
    console.error("Error resetting settings:", error);
    return NextResponse.json(
      { error: "Failed to reset settings" },
      { status: 500 }
    );
  }
}