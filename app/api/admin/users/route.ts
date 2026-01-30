import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { verifyAdminAccess } from "@/lib/auth";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const { authorized, userEmail, error } = await verifyAdminAccess();

    if (!authorized) {
      if (!userEmail) {
        return unauthorizedResponse(error || "Please sign in");
      }
      return forbiddenResponse(error || "Admin access required");
    }

    const supabase = createClient();

    // Fetch all users (only safe columns - no tokens!)
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select(`
        id, email, name, picture, created_at, updated_at,
        labels_created, gmail_label_ids, trial_started_at, trial_ends_at,
        subscription_status, subscription_tier, is_admin, role,
        emails_processed_count, last_active_at, drafts_created_count,
        onboarding_completed, notification_preferences,
        gmail_connected, gmail_connected_at, calendar_connected, calendar_connected_at
      `)
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("Failed to fetch users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Get email counts and settings for each user
    const usersWithEmailCounts = await Promise.all(
      (users || []).map(async (user) => {
        const { count } = await supabase
          .from("emails")
          .select("*", { count: "exact", head: true })
          .eq("user_email", user.email);

        // Get auto_poll_enabled from user_settings
        let autoPollEnabled = true; // Default to true
        const { data: settings } = await supabase
          .from("user_settings")
          .select("auto_poll_enabled")
          .or(`user_email.eq.${user.email},email.eq.${user.email}`)
          .single();

        if (settings && settings.auto_poll_enabled === false) {
          autoPollEnabled = false;
        }

        return {
          ...user,
          emails_processed: count || 0,
          auto_poll_enabled: autoPollEnabled,
        };
      })
    );

    return NextResponse.json({
      isAdmin: true,
      currentUserRole: userRole,
      users: usersWithEmailCounts,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
