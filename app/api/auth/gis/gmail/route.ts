import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase";

/**
 * POST /api/auth/gis/gmail
 * 
 * Handles GIS popup Gmail authorization - incremental auth for email features
 * User must already be logged in. This adds Gmail scopes and stores tokens.
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

    // Store Gmail tokens in Supabase
    const supabase = createClient();

    const { error: dbError } = await supabase
      .from("users")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date,
        gmail_connected: true,
        gmail_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    if (dbError) {
      console.error("Error storing Gmail tokens:", dbError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Gmail connected successfully",
    });
  } catch (error) {
    console.error("GIS Gmail connect error:", error);
    return NextResponse.json(
      { error: `Failed to connect Gmail: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
