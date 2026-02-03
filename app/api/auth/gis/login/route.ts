import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase";
import { cookies } from "next/headers";

/**
 * POST /api/auth/gis/login
 * 
 * Handles GIS popup login - exchanges auth code for tokens
 * Only requests basic profile scopes (email, profile, openid)
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "No authorization code" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'postmessage' // Required for popup/code flow
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) {
      return NextResponse.json({ error: "No email in user info" }, { status: 400 });
    }

    // Store user in Supabase
    const supabase = createClient();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("email, subscription_status")
      .eq("email", userInfo.email)
      .single();

    const userData: Record<string, unknown> = {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      updated_at: new Date().toISOString(),
      // Login-only: don't store integration tokens, don't mark integrations as connected
      // User will connect Gmail separately when they need it
    };

    // Initialize new users with defaults
    if (!existingUser) {
      userData.subscription_status = "trial";
      userData.subscription_tier = "free";
      userData.drafts_created_count = 0;
      userData.created_at = new Date().toISOString();
      userData.gmail_connected = false;
      userData.calendar_connected = false;
    }

    const { error: dbError } = await supabase.from("users").upsert(
      userData,
      { onConflict: "email" }
    );

    if (dbError) {
      console.error("Error storing user:", dbError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Set session cookie (simple JWT-like approach)
    // In production, use proper session management
    const sessionData = {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      exp: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    };

    const response = NextResponse.json({
      success: true,
      user: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
    });

    // Set HTTP-only cookie for session
    response.cookies.set('zeno_session', Buffer.from(JSON.stringify(sessionData)).toString('base64'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error("GIS login error:", error);
    return NextResponse.json(
      { error: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
