import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { deleteLabel, getLabels, refreshAccessToken } from "@/lib/gmail";

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

    // Get user with tokens
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.access_token || !user.refresh_token) {
      return NextResponse.json(
        { error: "Gmail not connected" },
        { status: 400 }
      );
    }

    // Get user settings to find our label IDs
    let { data: settings } = await supabase
      .from("user_settings")
      .select("our_label_ids")
      .eq("user_email", userEmail)
      .single();

    if (!settings) {
      const result = await supabase
        .from("user_settings")
        .select("our_label_ids")
        .eq("email", userEmail)
        .single();
      settings = result.data;
    }

    const ourLabelIds: Record<string, string> = settings?.our_label_ids || {};
    
    // Also get all Gmail labels to find any Zeno-prefixed ones we might have missed
    let accessToken = user.access_token;
    const allLabels = await getLabels(accessToken, user.refresh_token);
    
    // Find all labels that start with our prefix (space + emoji or just common Zeno names)
    const zenoLabelPrefixes = [" 1️⃣", " 2️⃣", " 3️⃣", " 4️⃣", " 5️⃣", " 6️⃣", " 7️⃣", " 8️⃣", " 🔴", " 🟠", " 🟡", " 🟢", " 🔵", " 🟣"];
    const zenoCategoryNames = [
      "Action Required", "FYI Only", "Team Updates", "Notifications",
      "Meetings & Events", "Waiting for Reply", "Completed", "Marketing & Spam",
      "Reply Needed", "For Info", "Mentions", "Updates", "Scheduled", "Pending", "Done", "Promo"
    ];

    const labelsToDelete: { id: string; name: string }[] = [];

    // Add labels from our_label_ids
    for (const [name, id] of Object.entries(ourLabelIds)) {
      labelsToDelete.push({ id, name });
    }

    // Find any other Zeno-like labels
    for (const label of allLabels) {
      // Skip if already in our list
      if (labelsToDelete.some(l => l.id === label.id)) continue;
      
      // Check if it matches our patterns
      const hasZenoPrefix = zenoLabelPrefixes.some(prefix => label.name.startsWith(prefix));
      const hasZenoName = zenoCategoryNames.some(name => 
        label.name.includes(name) || label.name.endsWith(name)
      );
      
      if (hasZenoPrefix || hasZenoName) {
        labelsToDelete.push({ id: label.id, name: label.name });
      }
    }

    // Delete all found labels
    let deleted = 0;
    const errors: string[] = [];

    for (const label of labelsToDelete) {
      try {
        await deleteLabel(accessToken, user.refresh_token, label.id);
        deleted++;
        console.log(`[delete-labels] Deleted: ${label.name} (${label.id})`);
      } catch (error: any) {
        // If token expired, refresh and retry
        if (error?.response?.status === 401) {
          try {
            accessToken = await refreshAccessToken(user.refresh_token);
            await supabase
              .from("users")
              .update({ access_token: accessToken })
              .eq("email", userEmail);
            
            await deleteLabel(accessToken, user.refresh_token, label.id);
            deleted++;
            console.log(`[delete-labels] Deleted (after refresh): ${label.name} (${label.id})`);
          } catch (retryError: any) {
            errors.push(`${label.name}: ${retryError.message}`);
          }
        } else {
          errors.push(`${label.name}: ${error.message}`);
        }
      }
    }

    // Clear our_label_ids in settings
    const updateResult = await supabase
      .from("user_settings")
      .update({ our_label_ids: {} })
      .eq("user_email", userEmail);

    if (updateResult.error) {
      // Try with email column
      await supabase
        .from("user_settings")
        .update({ our_label_ids: {} })
        .eq("email", userEmail);
    }

    return NextResponse.json({
      success: true,
      deleted,
      total: labelsToDelete.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Deleted ${deleted} of ${labelsToDelete.length} labels`,
    });

  } catch (error: any) {
    console.error("Error deleting labels:", error);
    return NextResponse.json(
      { error: `Failed to delete labels: ${error.message}` },
      { status: 500 }
    );
  }
}
