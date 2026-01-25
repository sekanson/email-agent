import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { google } from "googleapis";
import { BulkCleanupRequest, BulkCleanupResponse } from "@/lib/declutter-types";

export async function POST(request: NextRequest) {
  try {
    const {
      userEmail,
      action,
      olderThanDays,
      categories,
      senders,
    }: BulkCleanupRequest = await request.json();

    if (!userEmail || !action || !olderThanDays) {
      return NextResponse.json(
        { error: "Missing required fields: userEmail, action, olderThanDays" },
        { status: 400 }
      );
    }

    if (!["archive", "delete"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'archive' or 'delete'" },
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

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: user.access_token,
      refresh_token: user.refresh_token,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Build search query
    const beforeDate = new Date();
    beforeDate.setDate(beforeDate.getDate() - olderThanDays);
    const beforeTimestamp = Math.floor(beforeDate.getTime() / 1000);

    let query = `before:${beforeTimestamp}`;

    // Add category labels to query if specified
    if (categories && categories.length > 0) {
      // Convert category names to label format
      const labelQueries = categories.map((cat) => `label:zeno-${cat.toLowerCase().replace(/\//g, "-")}`);
      query += ` (${labelQueries.join(" OR ")})`;
    }

    // Add sender filter if specified
    if (senders && senders.length > 0) {
      const senderQueries = senders.map((s) => `from:${s}`);
      query += ` (${senderQueries.join(" OR ")})`;
    }

    // Fetch matching emails
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      maxResults: 500,
      q: query,
    });

    const messages = listResponse.data.messages || [];
    let processed = 0;
    let archived = 0;
    let deleted = 0;

    // Process in batches of 100 (Gmail API limit)
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const messageIds = batch.map((m) => m.id!);

      try {
        if (action === "archive") {
          // Remove from inbox (archive)
          await gmail.users.messages.batchModify({
            userId: "me",
            requestBody: {
              ids: messageIds,
              removeLabelIds: ["INBOX"],
            },
          });
          archived += messageIds.length;
        } else if (action === "delete") {
          // Move to trash
          await gmail.users.messages.batchModify({
            userId: "me",
            requestBody: {
              ids: messageIds,
              addLabelIds: ["TRASH"],
              removeLabelIds: ["INBOX"],
            },
          });
          deleted += messageIds.length;
        }
        processed += messageIds.length;
      } catch (batchError) {
        console.error("Error processing batch:", batchError);
        // Continue with remaining batches
      }
    }

    // Create a declutter session record
    const { data: session } = await supabase
      .from("declutter_sessions")
      .insert({
        user_email: userEmail,
        session_type: "bulk_cleanup",
        emails_processed: processed,
        emails_archived: archived,
        emails_deleted: deleted,
      })
      .select()
      .single();

    const response: BulkCleanupResponse = {
      success: true,
      processed,
      archived,
      deleted,
      sessionId: session?.id || "",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in bulk cleanup:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk cleanup" },
      { status: 500 }
    );
  }
}
