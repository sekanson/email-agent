import { NextRequest, NextResponse } from "next/server";
import { createLabel, getLabels, updateLabel, deleteLabel } from "@/lib/gmail";
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

    // Get user settings for categories and our_label_ids
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

    // Build a map of Gmail label IDs to their current names
    const gmailLabelMap = new Map<string, string>();
    for (const label of existingLabels) {
      gmailLabelMap.set(label.id, label.name);
    }

    const newOurLabelIds: Record<string, string> = {};
    let created = 0;
    let updated = 0;
    let renamed = 0;
    let deleted = 0;

    // Step 1: Process current categories - create, rename, or update
    for (const [num, config] of Object.entries(categories)) {
      if (!config.enabled) continue;

      const desiredName = config.name;
      const existingLabelId = ourLabelIds[num];

      if (existingLabelId) {
        // We have a label for this category number
        const currentGmailName = gmailLabelMap.get(existingLabelId);

        if (currentGmailName === undefined) {
          // Label was deleted from Gmail - recreate it
          console.log(`Label for category ${num} was deleted, recreating`);
          try {
            const newLabel = await createLabel(
              user.access_token,
              user.refresh_token,
              desiredName,
              config.color
            );
            newOurLabelIds[num] = newLabel.id;
            created++;
          } catch (error: any) {
            console.error(`Failed to recreate label ${desiredName}:`, error.message);
          }
        } else if (currentGmailName !== desiredName) {
          // Name changed - rename the label
          console.log(`Renaming label from "${currentGmailName}" to "${desiredName}"`);
          try {
            await updateLabel(
              user.access_token,
              user.refresh_token,
              existingLabelId,
              desiredName,
              config.color
            );
            newOurLabelIds[num] = existingLabelId;
            renamed++;
          } catch (error: any) {
            console.error(`Failed to rename label:`, error.message);
            // Keep the old label ID
            newOurLabelIds[num] = existingLabelId;
          }
        } else {
          // Name is the same - just update color
          try {
            await updateLabel(
              user.access_token,
              user.refresh_token,
              existingLabelId,
              desiredName,
              config.color
            );
            newOurLabelIds[num] = existingLabelId;
            updated++;
          } catch (error: any) {
            console.error(`Failed to update label color:`, error.message);
            newOurLabelIds[num] = existingLabelId;
          }
        }
      } else {
        // No existing label for this category - create new one
        // First check if a label with this name exists (that we don't own)
        const existingGmailLabel = existingLabels.find((l) => l.name === desiredName);

        if (existingGmailLabel) {
          // Label exists but we don't own it - create with suffix
          console.log(`Label "${desiredName}" exists but we don't own it, creating with suffix`);
          try {
            const newLabel = await createLabel(
              user.access_token,
              user.refresh_token,
              `${desiredName} (Email Agent)`,
              config.color
            );
            newOurLabelIds[num] = newLabel.id;
            created++;
          } catch (error: any) {
            console.error(`Failed to create label:`, error.message);
          }
        } else {
          // Create new label
          try {
            const newLabel = await createLabel(
              user.access_token,
              user.refresh_token,
              desiredName,
              config.color
            );
            newOurLabelIds[num] = newLabel.id;
            created++;
          } catch (error: any) {
            console.error(`Failed to create label ${desiredName}:`, error.message);
          }
        }
      }
    }

    // Step 2: Delete labels we own that are no longer in categories
    for (const [num, labelId] of Object.entries(ourLabelIds)) {
      // If this category number no longer exists or is disabled
      if (!categories[num] || !categories[num].enabled) {
        // Only delete if we own this label (it's in ourLabelIds)
        try {
          console.log(`Deleting label for removed category ${num}`);
          await deleteLabel(
            user.access_token,
            user.refresh_token,
            labelId
          );
          deleted++;
        } catch (deleteError: any) {
          // Label might already be deleted
          console.error(`Failed to delete label for category ${num}:`, deleteError.message);
        }
      }
    }

    // Step 3: Update user record
    await supabase
      .from("users")
      .update({
        labels_created: true,
        gmail_label_ids: newOurLabelIds,
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    // Step 4: Save our_label_ids to user_settings
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
      message: `Created ${created}, renamed ${renamed}, updated ${updated}, deleted ${deleted} labels`,
      stats: { created, renamed, updated, deleted },
    });
  } catch (error) {
    console.error("Error syncing labels:", error);
    return NextResponse.json(
      { error: "Failed to sync labels" },
      { status: 500 }
    );
  }
}
