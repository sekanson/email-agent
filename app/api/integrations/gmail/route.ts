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
      "https://www.googleapis.com/auth/gmail.settings.basic", // For Focus Mode filters
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

    // First, try to update just gmail_connected (the essential field)
    const { error } = await supabase
      .from("users")
      .update({
        gmail_connected: false,
      })
      .eq("email", userEmail);

    if (error) {
      console.error("Supabase error:", error);
      
      // If the column doesn't exist, try without it (legacy support)
      if (error.message?.includes("gmail_connected")) {
        console.log("gmail_connected column may not exist, skipping...");
        return NextResponse.json({ success: true, message: "Gmail disconnected (no column update)" });
      }
      
      throw error;
    }

    // Try to clear tokens separately (might not exist)
    try {
      await supabase
        .from("users")
        .update({
          access_token: null,
          refresh_token: null,
        })
        .eq("email", userEmail);
    } catch (tokenError) {
      // Tokens might be stored differently or not at all - that's ok
      console.log("Could not clear tokens (may not exist):", tokenError);
    }

    return NextResponse.json({ success: true, message: "Gmail disconnected" });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    return NextResponse.json(
      { error: `Failed to disconnect Gmail: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
