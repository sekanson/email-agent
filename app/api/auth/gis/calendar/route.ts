import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase";

/**
 * POST /api/auth/gis/calendar
 * 
 * Handles GIS popup Calendar authorization - incremental auth for calendar features
 * User must already be logged in. This adds Calendar scopes.
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "No authorization code" }, { status: 400 });
    }

    // Get current user from session cookie
    const sessionCookie = request.cookies.get('zeno_session');
    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let sessionData;
    try {
      sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (!sessionData.email || sessionData.exp < Date.now()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const userEmail = sessionData.email;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'postmessage' // Required for popup/code flow
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.json({ error: "Failed to get access token" }, { status: 500 });
    }

    // Store Calendar tokens in Supabase
    // Note: If user already has Gmail tokens, we need to merge/update carefully
    const supabase = createClient();

    // Get existing user to check if they have Gmail tokens
    const { data: existingUser } = await supabase
      .from("users")
      .select("access_token, refresh_token")
      .eq("email", userEmail)
      .single();

    const updateData: Record<string, unknown> = {
      calendar_connected: true,
      calendar_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // If user doesn't have tokens yet (rare case - usually Gmail is connected first)
    // store the calendar tokens
    if (!existingUser?.access_token) {
      updateData.access_token = tokens.access_token;
      updateData.refresh_token = tokens.refresh_token;
      updateData.token_expiry = tokens.expiry_date;
    }
    // Note: Ideally with incremental auth, the new token would have all previously granted scopes
    // For now, we'll use the existing Gmail token for email ops and may need to refresh for calendar

    const { error: dbError } = await supabase
      .from("users")
      .update(updateData)
      .eq("email", userEmail);

    if (dbError) {
      console.error("Error storing Calendar connection:", dbError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Calendar connected successfully",
    });
  } catch (error) {
    console.error("GIS Calendar connect error:", error);
    return NextResponse.json(
      { error: `Failed to connect Calendar: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
