import { NextRequest, NextResponse } from "next/server";
import { getEmails, applyLabel, createDraft } from "@/lib/gmail";
import { classifyEmailCategory, generateDraftResponse, DEFAULT_CATEGORIES, CategoryConfig } from "@/lib/claude";
import { createClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userEmail, maxEmails = 10 } = await request.json();

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

    if (!user.labels_created) {
      return NextResponse.json(
        { error: "Please setup Gmail labels first" },
        { status: 400 }
      );
    }

    // Get user settings - try user_email first, then email
    let { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    if (!settings) {
      const result = await supabase
        .from("user_settings")
        .select("*")
        .eq("email", userEmail)
        .single();
      settings = result.data;
    }

    const temperature = settings?.temperature || 0.7;
    const signature = settings?.signature || "";
    const draftsEnabled = settings?.drafts_enabled ?? true;
    const categories: Record<string, CategoryConfig> = settings?.categories || DEFAULT_CATEGORIES;
    const writingStyle = (settings?.use_writing_style && settings?.writing_style) ? settings.writing_style : "";

    // Get already processed email IDs
    const { data: processedEmails } = await supabase
      .from("emails")
      .select("gmail_id")
      .eq("user_email", userEmail);

    const processedIds = new Set(
      (processedEmails || []).map((e) => e.gmail_id)
    );

    // Fetch unread emails from Gmail
    const emails = await getEmails(
      user.access_token,
      user.refresh_token,
      maxEmails,
      "is:unread"
    );

    // Filter out already processed emails
    const newEmails = emails.filter((e) => !processedIds.has(e.id));

    const results = [];

    for (const email of newEmails) {
      try {
        // Step 1: Classify the email using user's categories
        const category = await classifyEmailCategory(
          email.from,
          email.subject,
          email.body || email.bodyPreview,
          categories
        );

        // Step 2: Apply the label
        // Look up the category name from the category number
        const categoryConfig = categories[category.toString()];
        const categoryName = categoryConfig?.name;
        // gmail_label_ids is now keyed by category NAME, not number
        const labelId = categoryName ? user.gmail_label_ids[categoryName] : null;
        if (labelId) {
          await applyLabel(
            user.access_token,
            user.refresh_token,
            email.id,
            labelId
          );
        } else {
          console.log(`No label found for category ${category} (${categoryName})`);
        }

        // Step 3: Generate draft for "To Respond" emails (category 1)
        let draftId = null;
        if (category === 1 && draftsEnabled) {
          try {
            // Extract sender email from "From" header
            const senderMatch = email.from.match(/<([^>]+)>/) || [
              null,
              email.from,
            ];
            const senderEmail = senderMatch[1] || email.from;

            console.log(`Generating draft response for: ${email.subject}`);
            console.log(`Sender email: ${senderEmail}`);
            console.log(`Thread ID: ${email.threadId}`);

            const draftBody = await generateDraftResponse(
              email.from,
              email.subject,
              email.body || email.bodyPreview,
              temperature,
              signature,
              writingStyle
            );

            console.log(`Draft body generated, creating Gmail draft...`);

            draftId = await createDraft(
              user.access_token,
              user.refresh_token,
              senderEmail,
              email.subject,
              draftBody,
              email.threadId
            );

            console.log(`Draft created successfully with ID: ${draftId}`);
          } catch (draftError: any) {
            console.error(`Failed to create draft for email ${email.id}:`, draftError);
            console.error(`Draft error details:`, draftError.message || draftError);
          }
        }

        // Step 4: Save to database
        const { data: savedEmail, error: saveError } = await supabase
          .from("emails")
          .upsert({
            user_email: userEmail,
            gmail_id: email.id,
            subject: email.subject,
            from: email.from,
            body_preview: email.bodyPreview,
            category: category,
            draft_id: draftId,
            processed_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (!saveError) {
          results.push({
            id: email.id,
            subject: email.subject,
            from: email.from,
            category,
            draftCreated: !!draftId,
          });
        }
      } catch (emailError) {
        console.error(`Failed to process email ${email.id}:`, emailError);
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      skipped: emails.length - newEmails.length,
      emails: results,
    });
  } catch (error) {
    console.error("Error processing emails:", error);
    return NextResponse.json(
      { error: "Failed to process emails" },
      { status: 500 }
    );
  }
}
