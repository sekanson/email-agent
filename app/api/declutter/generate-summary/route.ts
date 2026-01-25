import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import {
  GenerateSummaryRequest,
  GenerateSummaryResponse,
  ImportantEmail,
} from "@/lib/declutter-types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userEmail, type }: GenerateSummaryRequest = await request.json();

    if (!userEmail || !type) {
      return NextResponse.json(
        { error: "Missing required fields: userEmail, type" },
        { status: 400 }
      );
    }

    if (!["daily", "weekly"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'daily' or 'weekly'" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get user's OAuth tokens
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("access_token, refresh_token, name")
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

    // Calculate date range
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - (type === "daily" ? 1 : 7));
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

    // Fetch recent emails
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      maxResults: 100,
      q: `after:${afterTimestamp} in:inbox`,
    });

    const messages = listResponse.data.messages || [];

    // Fetch email details
    const emailDetails: {
      id: string;
      subject: string;
      from: string;
      snippet: string;
      labels: string[];
      date: string;
    }[] = [];

    for (const message of messages.slice(0, 50)) {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: message.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });

        const headers = msg.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === "Subject")?.value || "(No subject)";
        const from = headers.find((h) => h.name === "From")?.value || "Unknown";
        const date = headers.find((h) => h.name === "Date")?.value || "";

        emailDetails.push({
          id: message.id!,
          subject,
          from,
          snippet: msg.data.snippet || "",
          labels: msg.data.labelIds || [],
          date,
        });
      } catch (err) {
        console.error("Error fetching message:", err);
      }
    }

    // Count stats
    const stats = {
      totalEmails: emailDetails.length,
      categorizedEmails: emailDetails.filter((e) =>
        e.labels.some((l) => l.startsWith("Label_"))
      ).length,
      needsResponse: emailDetails.filter((e) =>
        e.labels.some((l) => l.toLowerCase().includes("respond"))
      ).length,
      newsletters: emailDetails.filter((e) =>
        e.labels.some((l) => l.toLowerCase().includes("marketing") || l.toLowerCase().includes("newsletter"))
      ).length,
    };

    // Use Claude to generate summary
    const emailSummaryInput = emailDetails
      .map((e) => `- From: ${e.from}\n  Subject: ${e.subject}\n  Preview: ${e.snippet.slice(0, 100)}`)
      .join("\n\n");

    const prompt = `You are an AI assistant helping summarize email activity.

Here are the emails from the ${type === "daily" ? "past day" : "past week"} for ${user.name || userEmail}:

${emailSummaryInput}

Please provide:
1. A brief, friendly summary of the email activity (2-3 sentences)
2. Identify the TOP 3 most important or urgent emails that need attention, with a brief reason why each is important

Format your response as JSON:
{
  "summary": "Your friendly summary here...",
  "importantEmails": [
    {"gmail_id": "id1", "subject": "subject1", "from": "sender1", "reason": "why it's important"},
    {"gmail_id": "id2", "subject": "subject2", "from": "sender2", "reason": "why it's important"},
    {"gmail_id": "id3", "subject": "subject3", "from": "sender3", "reason": "why it's important"}
  ]
}

Use the actual gmail_id values from the emails listed. Focus on emails that appear urgent, are from important contacts, or require action.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    // Parse Claude's response
    let summary = "";
    let importantEmails: ImportantEmail[] = [];

    try {
      const textContent = response.content.find((c) => c.type === "text");
      if (textContent && textContent.type === "text") {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          summary = parsed.summary || "";
          importantEmails = parsed.importantEmails || [];
        }
      }
    } catch (parseError) {
      console.error("Error parsing Claude response:", parseError);
      summary = `You received ${emailDetails.length} emails in the ${type === "daily" ? "past day" : "past week"}.`;
    }

    // Create a declutter session record
    const { data: session } = await supabase
      .from("declutter_sessions")
      .insert({
        user_email: userEmail,
        session_type: type === "daily" ? "daily_summary" : "weekly_summary",
        emails_processed: emailDetails.length,
        summary_text: summary,
        important_emails: importantEmails,
      })
      .select()
      .single();

    const responseData: GenerateSummaryResponse = {
      summary,
      importantEmails,
      stats,
      sessionId: session?.id || "",
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error generating summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
