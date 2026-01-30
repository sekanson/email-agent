import { NextRequest, NextResponse } from "next/server";
import { getEmails, refreshAccessToken } from "@/lib/gmail";
import { createClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to analyze your writing style");
    }

    const userEmail = authenticatedEmail; // Use authenticated email

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
      40, // Fetch more to filter down to 25 good ones
      "in:sent"
    );

    if (sentEmails.length === 0) {
      return NextResponse.json(
        { error: "No sent emails found to analyze" },
        { status: 400 }
      );
    }

    // Function to strip email signatures from body
    // Signatures typically start with common patterns
    function stripSignature(body: string): string {
      // Common signature delimiters and patterns
      const signaturePatterns = [
        /\n--\s*\n[\s\S]*$/,                    // Standard "-- " delimiter
        /\n_{3,}[\s\S]*$/,                       // Underscores separator
        /\n-{3,}[\s\S]*$/,                       // Dashes separator
        /\nSent from my [\s\S]*$/i,              // "Sent from my iPhone/Android"
        /\nGet Outlook for [\s\S]*$/i,           // Outlook mobile signature
        /\n<https?:\/\/[^\s]+>\s*$/,             // Trailing URL (often in signatures)
      ];

      let strippedBody = body;
      for (const pattern of signaturePatterns) {
        strippedBody = strippedBody.replace(pattern, '');
      }

      // Also try to detect signature blocks by looking for repeated patterns
      // like contact info blocks (phone, address, title lines)
      // Split into lines and look for signature-like endings
      const lines = strippedBody.split('\n');
      let cutoffIndex = lines.length;

      // Look backwards for signature-like patterns
      for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
        const line = lines[i].trim();
        // Skip empty lines
        if (!line) continue;

        // Check for common signature content (but not sign-offs like "Thanks")
        const isSignatureContent =
          /^[\w\s]+\|/.test(line) ||           // "Name | Title" format
          /^\+?\d[\d\s\-().]{7,}$/.test(line) || // Phone numbers
          /^www\.|^http/i.test(line) ||         // URLs
          /^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(line) && i > lines.length - 5; // Just a name at the end

        if (isSignatureContent) {
          cutoffIndex = i;
        }
      }

      if (cutoffIndex < lines.length) {
        strippedBody = lines.slice(0, cutoffIndex).join('\n');
      }

      return strippedBody.trim();
    }

    // Prepare email samples for analysis
    const emailSamples = sentEmails
      .filter((email) => email.body && email.body.length > 50) // Filter out very short emails
      .slice(0, 25) // Use top 25 emails
      .map((email, index) => {
        // Strip signature before analysis
        const bodyWithoutSignature = stripSignature(email.body);
        const body = bodyWithoutSignature.slice(0, 1000); // Limit body size
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
2. Typical greeting style (e.g., "Hi [Name]", "Hey", "Hello", or jumping straight to content)
3. Sign-off/outro style - how they close emails BEFORE any signature (e.g., "Thanks", "Best", "Regards", "Cheers", "- T", or no sign-off at all)
4. Sentence structure preferences (short/long, simple/complex)
5. Any distinctive vocabulary, phrases, or communication patterns

IMPORTANT:
- Focus on the SIGN-OFF style (the closing word/phrase like "Thanks" or "Best"), NOT the email signature block (name, title, phone, etc.)
- If the user has a casual sign-off like "- T" or just their initial, note that pattern
- If they don't use a sign-off and just end with their last sentence, note that too

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
      emailsAnalyzed: sentEmails.filter((e) => e.body && e.body.length > 50).slice(0, 25).length,
    });
  } catch (error: any) {
    console.error("Error analyzing writing style:", error);
    return NextResponse.json(
      { error: `Failed to analyze writing style: ${error.message}` },
      { status: 500 }
    );
  }
}
