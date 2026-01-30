import { NextRequest, NextResponse } from "next/server";
import { createLabel, getLabels, updateLabelColor, refreshAccessToken } from "@/lib/gmail";
import { createClient } from "@/lib/supabase";
import { DEFAULT_CATEGORIES, CategoryConfig } from "@/lib/claude";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  console.log("=== SETUP LABELS START ===");

  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to setup labels");
    }

    const userEmail = authenticatedEmail; // Use authenticated email
    console.log("User email:", userEmail);

    const supabase = createClient();

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      console.log("User not found:", userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Refresh token if needed
    let accessToken = user.access_token;
    const tokenExpiry = user.token_expiry;
    const now = Date.now();

    if (tokenExpiry && now > tokenExpiry - 60000) {
      console.log("Token expired, refreshing...");
      try {
        accessToken = await refreshAccessToken(user.refresh_token);
        await supabase
          .from("users")
          .update({ access_token: accessToken, updated_at: new Date().toISOString() })
          .eq("email", userEmail);
      } catch (refreshError) {
        console.error("Failed to refresh token:", refreshError);
      }
    }

    // Get user settings for categories
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
    let ourLabelIds: Record<string, string> = settings?.our_label_ids || {};

    console.log("Categories:", Object.values(categories).map(c => c.name));
    console.log("Existing our_label_ids:", ourLabelIds);

    // Get existing labels from Gmail
    const existingLabels = await getLabels(accessToken, user.refresh_token);
    console.log("Gmail labels count:", existingLabels.length);

    // Build set of Gmail label IDs for verification
    const gmailLabelIds = new Set(existingLabels.map((l) => l.id));

    // Verify existing labels still exist in Gmail
    for (const [labelName, labelId] of Object.entries(ourLabelIds)) {
      if (!gmailLabelIds.has(labelId)) {
        console.log(`Label "${labelName}" no longer exists in Gmail - removing from tracking`);
        delete ourLabelIds[labelName];
      }
    }

    const newOurLabelIds: Record<string, string> = { ...ourLabelIds };
    let created = 0;
    let updated = 0;

    // Create labels for each enabled category
    for (const [, config] of Object.entries(categories)) {
      if (!config.enabled) continue;

      const labelName = config.name;

      // Check if we already have a label for this name
      if (newOurLabelIds[labelName]) {
        // We already own this label - just update the color
        console.log(`Updating color for existing label: ${labelName}`);
        try {
          await updateLabelColor(accessToken, user.refresh_token, newOurLabelIds[labelName], config.color);
          updated++;
        } catch (colorError) {
          console.error(`Failed to update color for ${labelName}:`, colorError);
        }
        continue;
      }

      // Check if a label with this exact name already exists in Gmail
      const existingGmailLabel = existingLabels.find((l) => l.name === labelName);

      if (existingGmailLabel) {
        // Label with same name exists but we DIDN'T create it
        // DO NOT take ownership - this could be from another app (Fyxer, etc.)
        console.log(`Label "${labelName}" already exists in Gmail but is NOT ours`);
        console.log(`  → Creating with suffix to avoid conflict`);

        const suffixedName = `${labelName} (Zeno)`;
        const existingSuffixed = existingLabels.find((l) => l.name === suffixedName);

        if (existingSuffixed) {
          // We already have a suffixed version - use it
          console.log(`  → Found existing suffixed label: ${suffixedName}`);
          newOurLabelIds[labelName] = existingSuffixed.id;
          try {
            await updateLabelColor(accessToken, user.refresh_token, existingSuffixed.id, config.color);
            updated++;
          } catch (colorError) {
            console.error(`Failed to update color for ${suffixedName}:`, colorError);
          }
          continue;
        }

        // Create new label with suffix
        try {
          const newLabel = await createLabel(
            accessToken,
            user.refresh_token,
            suffixedName,
            config.color
          );
          console.log(`  ✓ Created "${suffixedName}" with ID: ${newLabel.id}`);
          newOurLabelIds[labelName] = newLabel.id;
          created++;
        } catch (error: any) {
          console.error(`Failed to create ${suffixedName}:`, error.message);
        }
        continue;
      }

      // No conflict - create new label with exact category name
      console.log(`Creating new label: ${labelName}`);
      try {
        const newLabel = await createLabel(
          accessToken,
          user.refresh_token,
          labelName,
          config.color
        );
        newOurLabelIds[labelName] = newLabel.id;
        created++;
      } catch (error: any) {
        console.error(`Failed to create label ${labelName}:`, error.message);
        // Don't claim ownership of external labels on error
        console.log(`  → Won't claim ownership of potentially external label`);
      }
    }

    console.log("Final our_label_ids:", newOurLabelIds);

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
    let { error: settingsError } = await supabase
      .from("user_settings")
      .update({ our_label_ids: newOurLabelIds })
      .eq("user_email", userEmail);

    if (settingsError) {
      await supabase
        .from("user_settings")
        .update({ our_label_ids: newOurLabelIds })
        .eq("email", userEmail);
    }

    console.log("=== SETUP LABELS COMPLETE ===");

    return NextResponse.json({
      success: true,
      labels: newOurLabelIds,
      message: `Created ${created} labels, updated ${updated} existing`,
    });
  } catch (error: any) {
    console.error("Error setting up labels:", error);
    return NextResponse.json(
      { error: `Failed to setup labels: ${error.message}` },
      { status: 500 }
    );
  }
}
