import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { google } from "googleapis";

export async function POST(request: NextRequest) {
  try {
    const { userEmail, to, subject, body } = await request.json();

    if (!userEmail || !to) {
      return NextResponse.json(
        { error: "Missing userEmail or recipient" },
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

    // Create the email message
    const emailSubject = subject || "Unsubscribe";
    const emailBody = body || "Please unsubscribe me from this mailing list.";

    const messageParts = [
      `From: ${userEmail}`,
      `To: ${to}`,
      `Subject: ${emailSubject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      emailBody,
    ];

    const message = messageParts.join("\n");

    // Encode the message in base64url format
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send the email
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Unsubscribe email sent to ${to}`,
    });
  } catch (error) {
    console.error("Error sending unsubscribe email:", error);
    return NextResponse.json(
      { error: "Failed to send unsubscribe email" },
      { status: 500 }
    );
  }
}
