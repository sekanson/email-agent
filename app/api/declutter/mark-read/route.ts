import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { google } from "googleapis";

interface ImportantEmail {
  gmail_id: string;
  subject: string;
  from: string;
  category: string;
  reason: string;
  has_thread: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { userEmail, sessionId, except } = await request.json();

    if (!userEmail || !sessionId) {
      return NextResponse.json(
        { error: "Missing userEmail or sessionId" },
        { status: 400 }
      );
    }

    if (!["important", "none"].includes(except)) {
      return NextResponse.json(
        { error: "Invalid except value. Must be 'important' or 'none'" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Load session from database
    const { data: session, error: sessionError } = await supabase
      .from("declutter_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_email", userEmail)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

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

    // Get IDs to keep unread (only important emails if except === "important")
    const keepUnreadIds = new Set<string>();
    const importantEmails: ImportantEmail[] = session.important_emails || [];

    if (except === "important") {
      for (const email of importantEmails) {
        keepUnreadIds.add(email.gmail_id);
      }
    }

    // Fetch all unread message IDs
    let allUnreadIds: string[] = [];
    let pageToken: string | undefined;

    do {
      const listResponse = await gmail.users.messages.list({
        userId: "me",
        q: "is:unread",
        maxResults: 500,
        pageToken,
      });

      const messages = listResponse.data.messages || [];
      allUnreadIds.push(...messages.map((m) => m.id!));
      pageToken = listResponse.data.nextPageToken || undefined;
    } while (pageToken && allUnreadIds.length < 5000);

    // Filter out IDs to keep unread
    const idsToMarkRead = allUnreadIds.filter((id) => !keepUnreadIds.has(id));

    // Batch mark as read (100 at a time)
    let markedRead = 0;
    const batchSize = 100;

    for (let i = 0; i < idsToMarkRead.length; i += batchSize) {
      const batchIds = idsToMarkRead.slice(i, i + batchSize);

      try {
        await gmail.users.messages.batchModify({
          userId: "me",
          requestBody: {
            ids: batchIds,
            removeLabelIds: ["UNREAD"],
          },
        });
        markedRead += batchIds.length;
      } catch (err) {
        console.error("Error marking batch as read:", err);
      }
    }

    // Update session with marked_read_count
    await supabase
      .from("declutter_sessions")
      .update({ marked_read_count: markedRead })
      .eq("id", sessionId);

    return NextResponse.json({
      markedRead,
      keptUnread: keepUnreadIds.size,
    });
  } catch (error) {
    console.error("Error marking emails as read:", error);
    return NextResponse.json(
      { error: "Failed to mark emails as read" },
      { status: 500 }
    );
  }
}
