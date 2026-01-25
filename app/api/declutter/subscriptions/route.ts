import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { GetSubscriptionsResponse } from "@/lib/declutter-types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("userEmail");
    const status = searchParams.get("status"); // Optional filter

    if (!userEmail) {
      return NextResponse.json(
        { error: "Missing userEmail parameter" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Build query
    let query = supabase
      .from("email_subscriptions")
      .select("*")
      .eq("user_email", userEmail)
      .order("email_count", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    // Calculate stats
    const stats = {
      total: subscriptions?.length || 0,
      active: subscriptions?.filter((s) => s.status === "active").length || 0,
      unsubscribed: subscriptions?.filter((s) => s.status === "unsubscribed").length || 0,
      blocked: subscriptions?.filter((s) => s.status === "blocked").length || 0,
      kept: subscriptions?.filter((s) => s.status === "kept").length || 0,
      pending: subscriptions?.filter((s) => s.user_action === null).length || 0,
    };

    const response: GetSubscriptionsResponse = {
      subscriptions: subscriptions || [],
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in subscriptions endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
