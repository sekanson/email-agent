import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  // If no code, redirect to Google OAuth
  if (!code) {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        // Gmail scopes
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.labels",
        // Calendar scopes
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
        // User info scopes
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      prompt: "consent",
    });

    return NextResponse.redirect(authUrl);
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Store tokens in Supabase
    const supabase = createClient();

    // Check if user already exists to preserve their data
    const { data: existingUser } = await supabase
      .from("users")
      .select("email, subscription_status, drafts_created_count")
      .eq("email", userInfo.email)
      .single();

    const { error } = await supabase.from("users").upsert(
      {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date,
        updated_at: new Date().toISOString(),
        // Initialize new users with defaults
        ...(existingUser ? {} : {
          subscription_status: "trial",
          subscription_tier: "free",
          drafts_created_count: 0,
          created_at: new Date().toISOString(),
        }),
      },
      { onConflict: "email" }
    );

    if (error) {
      console.error("Error storing user:", error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}?error=database_error`
      );
    }

    // Redirect to auth-success page with user info as query params
    // This page will store in localStorage and redirect to dashboard
    const params = new URLSearchParams({
      email: userInfo.email!,
      name: userInfo.name || "",
      picture: userInfo.picture || "",
    });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth-success?${params.toString()}`
    );
  } catch (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}?error=auth_failed`
    );
  }
}
