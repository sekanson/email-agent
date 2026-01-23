import { NextRequest, NextResponse } from "next/server";
import { getEmails, refreshAccessToken } from "@/lib/gmail";
import { createClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Refresh token if needed
    let accessToken = user.access_token;
    const tokenExpiry = user.token_expiry;
    const now = Date.now();

    if (tokenExpiry && now > tokenExpiry - 60000) {
      try {
        accessToken = await refreshAccessToken(user.refresh_token);
        await supabase
          .from("users")
          .update({
            access_token: accessToken,
            updated_at: new Date().toISOString(),
          })
          .eq("email", userEmail);
      } catch (refreshError) {
        console.error("Failed to refresh token:", refreshError);
        return NextResponse.json(
          { error: "Failed to refresh authentication" },
          { status: 401 }
        );
      }
    }

    // Fetch sent emails (get more to get a good sample)
    const sentEmails = await getEmails(
      accessToken,
      user.refresh_token,
      20, // Analyze up to 20 sent emails
      "in:sent"
    );

    if (sentEmails.length === 0) {
      return NextResponse.json(
        { error: "No sent emails found to analyze" },
        { status: 400 }
      );
    }

    // Prepare email samples for analysis
    const emailSamples = sentEmails
      .filter((email) => email.body && email.body.length > 50) // Filter out very short emails
      .slice(0, 10) // Use top 10 emails
      .map((email, index) => {
        const body = email.body.slice(0, 1000); // Limit body size
        return `--- Email ${index + 1} ---
Subject: ${email.subject}
Body:
${body}`;
      })
      .join("\n\n");

    if (!emailSamples) {
      return NextResponse.json(
        { error: "Not enough email content to analyze" },
        { status: 400 }
      );
    }

    // Use Claude to analyze writing style
    const prompt = `Analyze the writing style of these sent emails and create a concise writing style profile.

${emailSamples}

Based on these emails, create a short writing style summary (3-5 sentences) that describes:
1. Tone (formal, casual, friendly, professional, etc.)
2. Typical greeting and sign-off patterns
3. Sentence structure preferences (short/long, simple/complex)
4. Any distinctive vocabulary or phrases
5. Overall communication style

Format your response as a single paragraph that could be used to instruct an AI to mimic this writing style. Start directly with the description, no preamble.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response from AI" },
        { status: 500 }
      );
    }

    const styleDescription = content.text.trim();

    // Save the writing style to user_settings
    let { error: settingsError } = await supabase
      .from("user_settings")
      .update({
        writing_style: styleDescription,
        use_writing_style: true,
      })
      .eq("user_email", userEmail);

    if (settingsError) {
      // Try with email column
      await supabase
        .from("user_settings")
        .update({
          writing_style: styleDescription,
          use_writing_style: true,
        })
        .eq("email", userEmail);
    }

    return NextResponse.json({
      success: true,
      style: styleDescription,
      emailsAnalyzed: sentEmails.filter((e) => e.body && e.body.length > 50).slice(0, 10).length,
    });
  } catch (error: any) {
    console.error("Error analyzing writing style:", error);
    return NextResponse.json(
      { error: `Failed to analyze writing style: ${error.message}` },
      { status: 500 }
    );
  }
}
