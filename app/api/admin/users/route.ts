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

    // Check if requesting user is admin
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("is_admin")
      .eq("email", userEmail)
      .single();

    if (userError || !currentUser?.is_admin) {
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

    // Get email counts for each user
    const usersWithEmailCounts = await Promise.all(
      (users || []).map(async (user) => {
        const { count } = await supabase
          .from("emails")
          .select("*", { count: "exact", head: true })
          .eq("user_email", user.email);

        return {
          ...user,
          emails_processed: count || 0,
        };
      })
    );

    return NextResponse.json({
      isAdmin: true,
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
