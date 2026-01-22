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

    const { data: emails, error } = await supabase
      .from("emails")
      .select("*")
      .eq("user_email", userEmail)
      .order("processed_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching emails:", error);
      return NextResponse.json(
        { error: "Failed to fetch emails" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      emails: emails || [],
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
