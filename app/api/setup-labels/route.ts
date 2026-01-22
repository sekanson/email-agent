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

    // Get user settings for label prefix and categories - try user_email first, then email
    let { data: settings } = await supabase
      .from("user_settings")
      .select("label_prefix, categories")
      .eq("user_email", userEmail)
      .single();

    if (!settings) {
      const result = await supabase
        .from("user_settings")
        .select("label_prefix, categories")
        .eq("email", userEmail)
        .single();
      settings = result.data;
    }

    const labelPrefix = settings?.label_prefix || "C-";
    const categories: Record<string, CategoryConfig> = settings?.categories || DEFAULT_CATEGORIES;

    // Get existing labels
    const existingLabels = await getLabels(
      user.access_token,
      user.refresh_token
    );

    // Create labels and collect their IDs
    const labelIds: Record<string, string> = {};
    let created = 0;
    let updated = 0;

    // Create labels for each category
    for (const [num, config] of Object.entries(categories)) {
      if (!config.enabled) continue;

      const fullName = `${labelPrefix}${num}: ${config.name}`;

      // Check if label already exists with this exact name
      const existing = existingLabels.find((l) => l.name === fullName);

      if (existing) {
        labelIds[num] = existing.id;
        // Update color on existing label
        try {
          await updateLabelColor(
            user.access_token,
            user.refresh_token,
            existing.id,
            config.color
          );
          updated++;
        } catch (colorError) {
          console.error(`Failed to update color for ${fullName}:`, colorError);
        }
        continue;
      }

      // Create new label with color
      try {
        const newLabel = await createLabel(
          user.access_token,
          user.refresh_token,
          fullName,
          config.color
        );
        labelIds[num] = newLabel.id;
        created++;
      } catch (error: any) {
        // If label creation fails (e.g., already exists), try to find it
        console.error(`Failed to create label ${fullName}:`, error.message);
        const refreshedLabels = await getLabels(
          user.access_token,
          user.refresh_token
        );
        const found = refreshedLabels.find((l) => l.name === fullName);
        if (found) {
          labelIds[num] = found.id;
        }
      }
    }

    // IMPORTANT: Update user with NEW label IDs - this replaces any old label mappings
    const { error: updateError } = await supabase
      .from("users")
      .update({
        labels_created: true,
        gmail_label_ids: labelIds,
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    if (updateError) {
      console.error("Failed to update user:", updateError);
      return NextResponse.json(
        { error: "Failed to save label configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      labels: labelIds,
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
