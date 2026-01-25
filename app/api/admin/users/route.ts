import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Check if requesting user has admin access (admin, owner, or primary_owner)
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("is_admin, role")
      .eq("email", userEmail)
      .single();

    const userRole = currentUser?.role || "user";
    const canAccessAdmin = ["admin", "owner", "primary_owner"].includes(userRole) || currentUser?.is_admin;

    if (userError || !canAccessAdmin) {
      return NextResponse.json(
        { isAdmin: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    // Fetch all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
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
