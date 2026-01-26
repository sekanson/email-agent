import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase";

/**
 * GET /api/integrations/calendar
 * 
 * Initiates OAuth to connect Google Calendar
 * User must already be logged in
 */
export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/callback`
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      // Calendar scopes
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      // User info (needed for token)
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "consent",
    state: "connect_calendar",
  });

  return NextResponse.redirect(authUrl);
}

/**
 * DELETE /api/integrations/calendar
 * 
 * Disconnects Calendar integration
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");

    if (!userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("users")
      .update({
        calendar_connected: false,
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Calendar disconnected" });
  } catch (error) {
    console.error("Error disconnecting Calendar:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Calendar" },
      { status: 500 }
    );
  }
}
