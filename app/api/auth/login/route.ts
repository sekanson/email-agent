import { NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * GET /api/auth/login
 * 
 * Initiates OAuth with MINIMAL scopes (just profile/email)
 * This is the low-friction signup - users can connect Gmail later
 */
export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      // Minimal scopes - just profile info for login
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "consent",
    // Pass state to indicate this is login-only
    state: "login_only",
  });

  return NextResponse.redirect(authUrl);
}
