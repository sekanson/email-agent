import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");
    const sessionId = searchParams.get("sessionId");

    if (!userEmail || !sessionId) {
      return NextResponse.json(
        { error: "Missing userEmail or sessionId" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: session, error } = await supabase
      .from("declutter_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_email", userEmail)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}
