import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { google } from "googleapis";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to block senders");
    }

    const { senderEmail, action = "block" } = await request.json();
    const userEmail = authenticatedEmail; // Use authenticated email

    if (!senderEmail) {
      return NextResponse.json(
        { error: "Missing senderEmail" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get user's OAuth tokens
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("access_token, refresh_token")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Set up Gmail API client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: user.access_token,
      refresh_token: user.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    if (action === "block") {
      // Create a filter to skip inbox and mark as read for this sender
      const filter = await gmail.users.settings.filters.create({
        userId: "me",
        requestBody: {
          criteria: {
            from: senderEmail,
          },
          action: {
            removeLabelIds: ["INBOX", "UNREAD"],
          },
        },
      });

      return NextResponse.json({
        success: true,
        filterId: filter.data.id,
        message: `Blocked emails from ${senderEmail}`,
      });
    } else if (action === "spam") {
      // Find recent emails from this sender and mark as spam
      const listResponse = await gmail.users.messages.list({
        userId: "me",
        q: `from:${senderEmail}`,
        maxResults: 50,
      });

      const messageIds = (listResponse.data.messages || []).map((m) => m.id!);

      if (messageIds.length > 0) {
        // Move to spam
        await gmail.users.messages.batchModify({
          userId: "me",
          requestBody: {
            ids: messageIds,
            addLabelIds: ["SPAM"],
            removeLabelIds: ["INBOX"],
          },
        });
      }

      // Also create a filter to auto-spam future emails
      const filter = await gmail.users.settings.filters.create({
        userId: "me",
        requestBody: {
          criteria: {
            from: senderEmail,
          },
          action: {
            addLabelIds: ["SPAM"],
            removeLabelIds: ["INBOX"],
          },
        },
      });

      return NextResponse.json({
        success: true,
        filterId: filter.data.id,
        markedAsSpam: messageIds.length,
        message: `Reported ${senderEmail} as spam`,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'block' or 'spam'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error blocking sender:", error);
    return NextResponse.json(
      {
        error: "Failed to block sender",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
