import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");
    const dateRange = searchParams.get("dateRange") || "all";
    const limit = parseInt(searchParams.get("limit") || "100");
    const category = searchParams.get("category"); // Optional category filter

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Calculate date boundaries
    const now = new Date();
    let startDate: Date | null = null;

    switch (dateRange) {
      case "today":
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "all":
      default:
        startDate = null;
    }

    // Build query for emails
    let emailsQuery = supabase
      .from("emails")
      .select("*")
      .eq("user_email", userEmail)
      .order("processed_at", { ascending: false })
      .limit(limit);

    if (startDate) {
      emailsQuery = emailsQuery.gte("processed_at", startDate.toISOString());
    }

    // Apply category filter if specified
    if (category) {
      emailsQuery = emailsQuery.eq("category", parseInt(category));
    }

    const { data: emails, error: emailsError } = await emailsQuery;

    if (emailsError) {
      console.error("Error fetching emails:", emailsError);
      return NextResponse.json(
        { error: "Failed to fetch emails" },
        { status: 500 }
      );
    }

    // Get ALL emails for metrics (without category filter, but with date filter)
    let metricsQuery = supabase
      .from("emails")
      .select("category, draft_id")
      .eq("user_email", userEmail);

    if (startDate) {
      metricsQuery = metricsQuery.gte("processed_at", startDate.toISOString());
    }

    const { data: allEmailsForMetrics } = await metricsQuery;
    const metricsEmails = allEmailsForMetrics || [];

    // Calculate metrics from ALL emails (not limited/filtered)
    const totalProcessed = metricsEmails.length;
    const draftsCreated = metricsEmails.filter((e) => e.draft_id).length;

    // Count by category
    const byCategory: Record<number, number> = {};
    metricsEmails.forEach((email) => {
      const cat = email.category;
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    const toRespond = byCategory[1] || 0;
    const other = totalProcessed - toRespond;

    // Get total count (all time) for context
    const { count: totalAll } = await supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("user_email", userEmail);

    return NextResponse.json({
      emails: emails || [],
      metrics: {
        totalProcessed,
        toRespond,
        draftsCreated,
        other,
        byCategory,
        totalAll: totalAll || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("emails")
      .delete()
      .eq("user_email", userEmail);

    if (error) {
      console.error("Error deleting emails:", error);
      return NextResponse.json(
        { error: "Failed to reset metrics" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Metrics reset successfully",
    });
  } catch (error) {
    console.error("Error resetting metrics:", error);
    return NextResponse.json(
      { error: "Failed to reset metrics" },
      { status: 500 }
    );
  }
}
