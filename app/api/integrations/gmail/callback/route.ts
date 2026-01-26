import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase";

/**
 * GET /api/integrations/gmail/callback
 * 
 * Handles OAuth callback for Gmail connection
 * Stores Gmail-specific tokens
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/account?tab=integrations&error=gmail_denied`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/account?tab=integrations&error=no_code`
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gmail/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info to identify the account
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) {
      throw new Error("Could not get user email");
    }

    // Store Gmail tokens in database
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("users")
      .update({
        gmail_connected: true,
        gmail_connected_at: new Date().toISOString(),
        // Store Gmail-specific tokens
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date,
        updated_at: new Date().toISOString(),
      })
      .eq("email", userInfo.email);

    if (updateError) {
      console.error("Error storing Gmail tokens:", updateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/account?tab=integrations&error=database_error`
      );
    }

    // Success! Redirect to integrations with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/account?tab=integrations&success=gmail_connected`
    );
  } catch (error) {
    console.error("Gmail OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/account?tab=integrations&error=gmail_auth_failed`
    );
  }
}
