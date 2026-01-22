import { NextRequest, NextResponse } from "next/server";
import { createLabel, getLabels, updateLabelColor, refreshAccessToken } from "@/lib/gmail";
import { createClient } from "@/lib/supabase";
import { DEFAULT_CATEGORIES, CategoryConfig } from "@/lib/claude";

export async function POST(request: NextRequest) {
  console.log("=== SETUP LABELS START ===");

  try {
    const { userEmail } = await request.json();
    console.log("User email:", userEmail);

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
    // our_label_ids now maps category NAME to Gmail label ID
    const ourLabelIds: Record<string, string> = settings?.our_label_ids || {};

    console.log("Categories:", Object.values(categories).map(c => c.name));
    console.log("Existing our_label_ids:", ourLabelIds);

    // Get existing labels from Gmail
    const existingLabels = await getLabels(accessToken, user.refresh_token);
    console.log("Gmail labels count:", existingLabels.length);

    // Create labels and collect their IDs (keyed by NAME, not number)
    const newOurLabelIds: Record<string, string> = { ...ourLabelIds };
    let created = 0;
    let updated = 0;

    // Create labels for each enabled category
    for (const [, config] of Object.entries(categories)) {
      if (!config.enabled) continue;

      const labelName = config.name;

      // Check if we already have a label for this name
      if (ourLabelIds[labelName]) {
        // We already own this label - just update the color
        console.log(`Updating color for existing label: ${labelName}`);
        try {
          await updateLabelColor(accessToken, user.refresh_token, ourLabelIds[labelName], config.color);
          updated++;
        } catch (colorError) {
          console.error(`Failed to update color for ${labelName}:`, colorError);
        }
        continue;
      }

      // Check if a label with this exact name already exists in Gmail
      const existingGmailLabel = existingLabels.find((l) => l.name === labelName);

      if (existingGmailLabel) {
        // Label exists but we don't own it - create with different name
        console.log(`Label "${labelName}" exists in Gmail, creating with suffix`);
        try {
          const newLabel = await createLabel(
            accessToken,
            user.refresh_token,
            `${labelName} (Email Agent)`,
            config.color
          );
          newOurLabelIds[labelName] = newLabel.id;
          created++;
        } catch (error: any) {
          console.error(`Failed to create label ${labelName}:`, error.message);
        }
        continue;
      }

      // Create new label
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
        // Try to find it if creation failed
        const refreshedLabels = await getLabels(accessToken, user.refresh_token);
        const found = refreshedLabels.find((l) => l.name === labelName);
        if (found) {
          newOurLabelIds[labelName] = found.id;
        }
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
