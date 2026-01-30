import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to view analytics");
    }

    const userEmail = authenticatedEmail; // Use authenticated email

    const supabase = createClient();

    // Get user data
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("drafts_created_count, subscription_status, created_at")
      .eq("email", userEmail)
      .single();

    if (userError) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get all-time email count
    const { count: totalEmails } = await supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("user_email", userEmail);

    // Get this month's email count
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyEmails } = await supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("user_email", userEmail)
      .gte("processed_at", startOfMonth.toISOString());

    // Get this month's drafts (emails with draft_id not null)
    const { count: monthlyDrafts } = await supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("user_email", userEmail)
      .not("draft_id", "is", null)
      .gte("processed_at", startOfMonth.toISOString());

    // Get this month's "needs response" emails (category 1)
    const { count: monthlyNeedsResponse } = await supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("user_email", userEmail)
      .eq("category", 1)
      .gte("processed_at", startOfMonth.toISOString());

    // Get category breakdown (all time)
    const { data: categoryData } = await supabase
      .from("emails")
      .select("category")
      .eq("user_email", userEmail);

    const categoryBreakdown: Record<number, number> = {};
    (categoryData || []).forEach((email) => {
      const cat = email.category;
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    // Get user's category names
    const { data: settings } = await supabase
      .from("user_settings")
      .select("categories")
      .eq("user_email", userEmail)
      .single();

    // Get daily activity for last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const { data: recentEmails } = await supabase
      .from("emails")
      .select("processed_at")
      .eq("user_email", userEmail)
      .gte("processed_at", fourteenDaysAgo.toISOString())
      .order("processed_at", { ascending: true });

    // Group by day
    const dailyActivity: { date: string; count: number }[] = [];
    const dayMap: Record<string, number> = {};

    // Initialize all 14 days with 0
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      const dateStr = date.toISOString().split("T")[0];
      dayMap[dateStr] = 0;
    }

    // Count emails per day
    (recentEmails || []).forEach((email) => {
      const dateStr = email.processed_at.split("T")[0];
      if (dayMap[dateStr] !== undefined) {
        dayMap[dateStr]++;
      }
    });

    // Convert to array
    Object.entries(dayMap).forEach(([date, count]) => {
      dailyActivity.push({ date, count });
    });

    // Calculate response rate
    const responseRate = monthlyNeedsResponse && monthlyNeedsResponse > 0
      ? Math.round((monthlyDrafts || 0) / monthlyNeedsResponse * 100)
      : 0;

    return NextResponse.json({
      overview: {
        totalEmails: totalEmails || 0,
        monthlyEmails: monthlyEmails || 0,
        monthlyDrafts: monthlyDrafts || 0,
        responseRate,
      },
      categoryBreakdown,
      categories: settings?.categories || null,
      dailyActivity,
      draftsUsed: user.drafts_created_count || 0,
      isProUser: user.subscription_status === "active",
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
