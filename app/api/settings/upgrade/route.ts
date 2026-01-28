import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { 
  CURRENT_SCHEMA_VERSIONS, 
  getUpgradePromptKey, 
  type SchemaKey 
} from "@/lib/schema-versions";
import { 
  mergeUserSettingsWithDefaults, 
  getCategoriesForUserVersion,
  DEFAULT_USER_SETTINGS 
} from "@/lib/settings-merge";
import { DEFAULT_CATEGORIES_V2 } from "@/lib/categories";

export async function POST(request: NextRequest) {
  try {
    const { 
      userEmail, 
      schema, 
      action, // 'upgrade' | 'keep' | 'dismiss'
      fromVersion,
      toVersion 
    } = await request.json();

    if (!userEmail || !schema || !action) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

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

    const currentSettings = mergeUserSettingsWithDefaults(existingSettings);

    // Initialize tracking objects if they don't exist
    const schemaVersions = { ...currentSettings.schemaVersions };
    const upgradePromptsShown = { ...currentSettings.upgradePromptsShown };

    const promptKey = getUpgradePromptKey(schema as SchemaKey, toVersion);

    let updatedSettings = { ...currentSettings };

    switch (action) {
      case 'upgrade':
        // Apply the upgrade
        schemaVersions[schema as SchemaKey] = toVersion;
        
        // Apply schema-specific upgrades
        if (schema === 'categories' && toVersion === 'v2') {
          updatedSettings.categories = DEFAULT_CATEGORIES_V2;
        }
        
        // Mark prompt as shown
        upgradePromptsShown[promptKey] = true;
        break;

      case 'keep':
        // Keep current version but mark prompt as shown
        upgradePromptsShown[promptKey] = true;
        break;

      case 'dismiss':
        // Just mark prompt as shown without changing version
        upgradePromptsShown[promptKey] = true;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update settings with new schema version and prompt tracking
    updatedSettings.schemaVersions = schemaVersions;
    updatedSettings.upgradePromptsShown = upgradePromptsShown;

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
      console.error("Error saving upgrade:", error);
      return NextResponse.json(
        { error: `Failed to save upgrade: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      schema,
      newVersion: schemaVersions[schema as SchemaKey],
      settings: data,
    });

  } catch (error) {
    console.error("Error processing upgrade:", error);
    return NextResponse.json(
      { error: "Failed to process upgrade" },
      { status: 500 }
    );
  }
}