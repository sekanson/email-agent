import { NextRequest, NextResponse } from "next/server";
import { createLabel, getLabels, updateLabelColor } from "@/lib/gmail";
import { createClient } from "@/lib/supabase";
import { DEFAULT_CATEGORIES, CategoryConfig } from "@/lib/claude";

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();

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

    // Get user settings for categories - try user_email first, then email
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

    const categories: Record<string, CategoryConfig> = settings?.categories || DEFAULT_CATEGORIES;
    const ourLabelIds: Record<string, string> = settings?.our_label_ids || {};

    // Get existing labels from Gmail
    const existingLabels = await getLabels(
      user.access_token,
      user.refresh_token
    );

    // Create labels and collect their IDs
    const newOurLabelIds: Record<string, string> = { ...ourLabelIds };
    let created = 0;
    let updated = 0;

    // Create labels for each enabled category
    for (const [num, config] of Object.entries(categories)) {
      if (!config.enabled) continue;

      // Use category name directly as label name (no prefix)
      const labelName = config.name;

      // Check if we already own a label for this category number
      const existingOurLabelId = ourLabelIds[num];

      if (existingOurLabelId) {
        // We own this label - just update the color
        try {
          await updateLabelColor(
            user.access_token,
            user.refresh_token,
            existingOurLabelId,
            config.color
          );
          updated++;
        } catch (colorError) {
          console.error(`Failed to update color for ${labelName}:`, colorError);
        }
        continue;
      }

      // Check if a label with this exact name already exists in Gmail
      const existingGmailLabel = existingLabels.find((l) => l.name === labelName);

      if (existingGmailLabel) {
        // Label exists but we don't own it - don't touch it, create with different name
        console.log(`Label "${labelName}" already exists in Gmail, creating with suffix`);
        try {
          const newLabel = await createLabel(
            user.access_token,
            user.refresh_token,
            `${labelName} (Email Agent)`,
            config.color
          );
          newOurLabelIds[num] = newLabel.id;
          created++;
        } catch (error: any) {
          console.error(`Failed to create label ${labelName}:`, error.message);
        }
        continue;
      }

      // Create new label
      try {
        const newLabel = await createLabel(
          user.access_token,
          user.refresh_token,
          labelName,
          config.color
        );
        newOurLabelIds[num] = newLabel.id;
        created++;
      } catch (error: any) {
        console.error(`Failed to create label ${labelName}:`, error.message);
        // Try to find it if creation failed
        const refreshedLabels = await getLabels(
          user.access_token,
          user.refresh_token
        );
        const found = refreshedLabels.find((l) => l.name === labelName);
        if (found) {
          newOurLabelIds[num] = found.id;
        }
      }
    }

    // Update user with labels_created flag
    await supabase
      .from("users")
      .update({
        labels_created: true,
        gmail_label_ids: newOurLabelIds,
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    // Save our_label_ids to user_settings
    const settingsUpdate = { our_label_ids: newOurLabelIds };

    // Try user_email first
    let { error: settingsError } = await supabase
      .from("user_settings")
      .update(settingsUpdate)
      .eq("user_email", userEmail);

    // If that fails, try email
    if (settingsError) {
      await supabase
        .from("user_settings")
        .update(settingsUpdate)
        .eq("email", userEmail);
    }

    return NextResponse.json({
      success: true,
      labels: newOurLabelIds,
      message: `Created ${created} labels, updated ${updated} existing`,
    });
  } catch (error) {
    console.error("Error setting up labels:", error);
    return NextResponse.json(
      { error: "Failed to setup labels" },
      { status: 500 }
    );
  }
}
