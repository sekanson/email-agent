import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase";

/**
 * GET /api/integrations/gmail
 * 
 * Initiates OAuth to connect Gmail with full email scopes
 * User must already be logged in
 */
export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gmail/callback`
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      // Gmail scopes
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.labels",
      // User info (needed for token)
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "consent",
    state: "connect_gmail",
  });

  return NextResponse.redirect(authUrl);
}

/**
 * DELETE /api/integrations/gmail
 * 
 * Disconnects Gmail integration
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");

    if (!userEmail) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createClient();

    // Update user to remove Gmail access (keep account but clear Gmail tokens)
    const { error } = await supabase
      .from("users")
      .update({
        gmail_connected: false,
        gmail_access_token: null,
        gmail_refresh_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Gmail disconnected" });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Gmail" },
      { status: 500 }
    );
  }
}
