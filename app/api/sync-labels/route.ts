import { NextRequest, NextResponse } from "next/server";
import { createLabel, getLabels, updateLabel, deleteLabel, refreshAccessToken } from "@/lib/gmail";
import { createClient } from "@/lib/supabase";
import { DEFAULT_CATEGORIES, CategoryConfig } from "@/lib/claude";

export async function POST(request: NextRequest) {
  console.log("=== SYNC LABELS START ===");

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

    console.log("User found, checking token expiry...");

    // Refresh token if needed
    let accessToken = user.access_token;
    const tokenExpiry = user.token_expiry;
    const now = Date.now();

    if (tokenExpiry && now > tokenExpiry - 60000) {
      console.log("Token expired or expiring soon, refreshing...");
      try {
        accessToken = await refreshAccessToken(user.refresh_token);
        await supabase
          .from("users")
          .update({ access_token: accessToken, updated_at: new Date().toISOString() })
          .eq("email", userEmail);
        console.log("Token refreshed successfully");
      } catch (refreshError) {
        console.error("Failed to refresh token:", refreshError);
      }
    }

    // Get user settings for categories and our_label_ids
    let { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("categories, our_label_ids")
      .eq("user_email", userEmail)
      .single();

    console.log("Settings query (user_email):", { settings, error: settingsError?.message });

    if (!settings) {
      const result = await supabase
        .from("user_settings")
        .select("categories, our_label_ids")
        .eq("email", userEmail)
        .single();
      settings = result.data;
      console.log("Settings query (email):", { settings, error: result.error?.message });
    }

    const categories: Record<string, CategoryConfig> = settings?.categories || DEFAULT_CATEGORIES;
    let ourLabelIds: Record<string, string> = settings?.our_label_ids || {};

    console.log("=== CURRENT STATE ===");
    console.log("Categories from DB:", JSON.stringify(categories, null, 2));
    console.log("our_label_ids from DB:", JSON.stringify(ourLabelIds, null, 2));

    // Get current category names (enabled only)
    const currentCategoryNames = Object.values(categories)
      .filter((c) => c.enabled)
      .map((c) => c.name);

    console.log("Current enabled category names:", currentCategoryNames);
    console.log("Labels we think we own:", Object.keys(ourLabelIds));

    // Fetch all labels from Gmail
    console.log("Fetching labels from Gmail...");
    let gmailLabels;
    try {
      gmailLabels = await getLabels(accessToken, user.refresh_token);
      console.log("Gmail labels fetched:", gmailLabels.length, "labels");
    } catch (gmailError: any) {
      console.error("Failed to fetch Gmail labels:", gmailError.message);
      return NextResponse.json(
        { error: `Gmail API error: ${gmailError.message}` },
        { status: 500 }
      );
    }

    // Build set of Gmail label IDs for quick lookup
    const gmailLabelIds = new Set(gmailLabels.map((l) => l.id));

    console.log("=== STEP 0: VERIFY labels still exist in Gmail ===");

    // Check each label we think we own - remove any that no longer exist
    const labelsToRemove: string[] = [];
    for (const [labelName, labelId] of Object.entries(ourLabelIds)) {
      if (!gmailLabelIds.has(labelId)) {
        console.log(`Label "${labelName}" (${labelId}) no longer exists in Gmail - removing from tracking`);
        labelsToRemove.push(labelName);
      } else {
        console.log(`Label "${labelName}" (${labelId}) verified - exists in Gmail`);
      }
    }

    // Remove stale labels from our tracking
    for (const labelName of labelsToRemove) {
      delete ourLabelIds[labelName];
    }

    if (labelsToRemove.length > 0) {
      console.log(`Removed ${labelsToRemove.length} stale labels from tracking`);
    }

    const newOurLabelIds: Record<string, string> = {};
    let created = 0;
    let deleted = 0;
    let updated = 0;

    console.log("=== STEP 1: DELETE labels no longer in categories ===");

    // Delete labels we own that are no longer in current category names
    for (const [labelName, labelId] of Object.entries(ourLabelIds)) {
      if (!currentCategoryNames.includes(labelName)) {
        console.log(`DELETING: "${labelName}" (ID: ${labelId}) - not in current categories`);
        try {
          await deleteLabel(accessToken, user.refresh_token, labelId);
          console.log(`  ✓ Deleted successfully`);
          deleted++;
        } catch (deleteError: any) {
          console.error(`  ✗ Failed to delete: ${deleteError.message}`);
        }
      } else {
        // Label still needed - keep it
        console.log(`KEEPING: "${labelName}" (ID: ${labelId})`);
        newOurLabelIds[labelName] = labelId;
      }
    }

    console.log("=== STEP 2: CREATE labels for new categories ===");

    // Create labels for categories we don't have yet
    // IMPORTANT: We NEVER take ownership of pre-existing labels to avoid deleting
    // labels created by other apps (like Fyxer)
    for (const categoryName of currentCategoryNames) {
      if (newOurLabelIds[categoryName]) {
        // Already have this label in our tracking
        continue;
      }

      console.log(`CREATING: "${categoryName}" - not in our_label_ids`);

      // Check if a label with this exact name already exists in Gmail
      const existingLabel = gmailLabels.find((l) => l.name === categoryName);

      if (existingLabel) {
        // Label with same name exists but we DIDN'T create it
        // DO NOT take ownership - create with a suffix instead
        console.log(`  → Label "${categoryName}" already exists in Gmail (ID: ${existingLabel.id})`);
        console.log(`  → This is NOT our label - creating with suffix to avoid conflict`);

        const suffixedName = `${categoryName} (Zeno)`;
        const existingSuffixed = gmailLabels.find((l) => l.name === suffixedName);

        if (existingSuffixed) {
          // We already have a suffixed version - use it
          console.log(`  → Found existing suffixed label: ${suffixedName}`);
          newOurLabelIds[categoryName] = existingSuffixed.id;
          continue;
        }

        // Create new label with suffix
        try {
          const category = Object.values(categories).find((c) => c.name === categoryName);
          const newLabel = await createLabel(
            accessToken,
            user.refresh_token,
            suffixedName,
            category?.color
          );
          console.log(`  ✓ Created "${suffixedName}" with ID: ${newLabel.id}`);
          newOurLabelIds[categoryName] = newLabel.id;
          created++;
        } catch (createError: any) {
          console.error(`  ✗ Failed to create "${suffixedName}": ${createError.message}`);
        }
        continue;
      }

      // No conflict - create new label with exact category name
      try {
        const category = Object.values(categories).find((c) => c.name === categoryName);
        const newLabel = await createLabel(
          accessToken,
          user.refresh_token,
          categoryName,
          category?.color
        );
        console.log(`  ✓ Created "${categoryName}" with ID: ${newLabel.id}`);
        newOurLabelIds[categoryName] = newLabel.id;
        created++;
      } catch (createError: any) {
        console.error(`  ✗ Failed to create "${categoryName}": ${createError.message}`);
        // If creation failed due to race condition, check if it exists now
        const refreshedLabels = await getLabels(accessToken, user.refresh_token);
        const found = refreshedLabels.find((l) => l.name === categoryName);
        if (found) {
          // Verify this is a label we just created (check our tracking)
          // Only add if we're confident we created it
          console.log(`  → Found label after error - but won't claim ownership of external labels`);
        }
      }
    }

    console.log("=== STEP 3: UPDATE colors for existing labels ===");

    // Refresh Gmail labels to get actual label names (might have suffix)
    const refreshedGmailLabels = await getLabels(accessToken, user.refresh_token);
    const labelIdToName = new Map(refreshedGmailLabels.map((l) => [l.id, l.name]));

    // Update colors for labels we're keeping
    for (const [categoryName, labelId] of Object.entries(newOurLabelIds)) {
      const category = Object.values(categories).find((c) => c.name === categoryName);
      if (category) {
        // Get actual Gmail label name (might be suffixed)
        const actualLabelName = labelIdToName.get(labelId) || categoryName;
        try {
          await updateLabel(accessToken, user.refresh_token, labelId, actualLabelName, category.color);
          console.log(`  ✓ Updated color for "${actualLabelName}"`);
          updated++;
        } catch (updateError: any) {
          console.error(`  ✗ Failed to update "${actualLabelName}": ${updateError.message}`);
        }
      }
    }

    console.log("=== STEP 4: SAVE to database ===");
    console.log("New our_label_ids to save:", JSON.stringify(newOurLabelIds, null, 2));

    // Update user record
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({
        labels_created: true,
        gmail_label_ids: newOurLabelIds,
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    if (userUpdateError) {
      console.error("Failed to update users table:", userUpdateError);
    } else {
      console.log("  ✓ Updated users table");
    }

    // Save our_label_ids to user_settings
    let { error: settingsUpdateError } = await supabase
      .from("user_settings")
      .update({ our_label_ids: newOurLabelIds })
      .eq("user_email", userEmail);

    if (settingsUpdateError) {
      console.log("user_email update failed, trying email...", settingsUpdateError.message);
      const result = await supabase
        .from("user_settings")
        .update({ our_label_ids: newOurLabelIds })
        .eq("email", userEmail);
      settingsUpdateError = result.error;
    }

    if (settingsUpdateError) {
      console.error("Failed to update user_settings:", settingsUpdateError);
    } else {
      console.log("  ✓ Updated user_settings table");
    }

    console.log("=== SYNC LABELS COMPLETE ===");
    console.log(`Results: created=${created}, deleted=${deleted}, updated=${updated}, stale_removed=${labelsToRemove.length}`);

    return NextResponse.json({
      success: true,
      labels: newOurLabelIds,
      stats: { created, deleted, updated, staleRemoved: labelsToRemove.length },
      message: `Created ${created}, deleted ${deleted}, updated ${updated} labels`,
    });
  } catch (error: any) {
    console.error("=== SYNC LABELS ERROR ===", error);
    return NextResponse.json(
      { error: `Failed to sync labels: ${error.message}` },
      { status: 500 }
    );
  }
}
