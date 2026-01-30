import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { deleteLabel, getLabels, refreshAccessToken } from "@/lib/gmail";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

// Gmail system labels that cannot be deleted
const SYSTEM_LABELS = [
  'INBOX', 'SENT', 'TRASH', 'SPAM', 'DRAFT', 'STARRED', 'IMPORTANT',
  'UNREAD', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CHAT', 'SCHEDULED'
];

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to delete labels");
    }

    const userEmail = authenticatedEmail; // Use authenticated email

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

    // Get ALL Gmail labels
    let accessToken = user.access_token;
    const allLabels = await getLabels(accessToken, user.refresh_token);
    
    // Filter to only user-created labels (exclude system labels)
    const labelsToDelete = allLabels.filter(label => {
      // Skip system labels
      if (SYSTEM_LABELS.includes(label.id) || SYSTEM_LABELS.includes(label.name)) {
        return false;
      }
      // Skip labels that start with system prefixes
      if (label.id.startsWith('CATEGORY_') || label.id.startsWith('CHAT')) {
        return false;
      }
      // Only delete user-created labels (they have Label_ prefix in ID)
      return label.id.startsWith('Label_') || !label.id.match(/^[A-Z_]+$/);
    });

    console.log(`[delete-labels] Found ${labelsToDelete.length} user labels to delete for ${userEmail}`);

    // Delete all user-created labels
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
          // Some labels might fail (system labels we missed, etc.) - just log and continue
          console.log(`[delete-labels] Could not delete ${label.name}: ${error.message}`);
          errors.push(`${label.name}: ${error.message}`);
        }
      }
    }

    // Clear our_label_ids in settings since we're starting fresh
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
