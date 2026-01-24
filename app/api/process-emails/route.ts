import { NextRequest, NextResponse } from "next/server";
import { getEmails, applyLabel, createDraft, getThreadMessages, formatThreadForAI } from "@/lib/gmail";
import {
  classifyEmailWithContext,
  generateDraftResponse,
  DEFAULT_CATEGORIES,
  CategoryConfig,
  ClassificationResult,
} from "@/lib/claude";
import { createClient } from "@/lib/supabase";
import { getSenderContext } from "@/lib/sender-context";

// Free tier limit for drafts
const FREE_DRAFT_LIMIT = 10;

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
        // Step 1: Get sender context for enhanced classification
        const senderContext = await getSenderContext(userEmail, email.fromEmail);

        // Step 2: Classify the email with thread detection and sender context
        const result: ClassificationResult = await classifyEmailWithContext(
          {
            from: email.from,
            fromEmail: email.fromEmail,
            subject: email.subject,
            body: email.body || email.bodyPreview,
            references: email.references,
            inReplyTo: email.inReplyTo,
          },
          senderContext,
          categories
        );

        const category = result.category;

        // Step 3: Apply the label
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

        // Step 4: Generate draft for "To Respond" emails (category 1)
        let draftId = null;
        let draftSkippedDueToLimit = false;

        // Check if user can create drafts (paid user or under free limit)
        const canCreateDraft =
          user.subscription_status === "active" ||
          (user.drafts_created_count || 0) < FREE_DRAFT_LIMIT;

        if (category === 1 && draftsEnabled) {
          if (!canCreateDraft) {
            console.log(`Draft limit reached for user ${userEmail}. Drafts created: ${user.drafts_created_count || 0}`);
            draftSkippedDueToLimit = true;
          } else {
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

              // Fetch full thread context for better responses
              let threadContext = "";
              try {
                const threadMessages = await getThreadMessages(
                  user.access_token,
                  user.refresh_token,
                  email.threadId,
                  userEmail
                );
                threadContext = formatThreadForAI(threadMessages);
                if (threadContext) {
                  console.log(`Loaded ${threadMessages.length} messages from thread for context`);
                }
              } catch (threadError) {
                console.log(`Could not load thread context: ${threadError}`);
              }

              const draftBody = await generateDraftResponse(
                email.from,
                email.subject,
                email.body || email.bodyPreview,
                temperature,
                signature,
                writingStyle,
                threadContext  // Pass thread context to AI
              );

              console.log(`Draft body generated, creating Gmail draft...`);

              // Build CC list for reply-all
              // Include original CC recipients + original To recipients (except sender and user)
              let ccRecipients: string[] = [];

              // Add original CC recipients
              if (email.cc) {
                ccRecipients.push(...email.cc.split(',').map(addr => addr.trim()));
              }

              // Add original To recipients (for multi-recipient emails, reply-all should include them)
              if (email.to) {
                ccRecipients.push(...email.to.split(',').map(addr => addr.trim()));
              }

              // Filter and dedupe: remove sender (they go in To), remove user's own email
              const senderEmailLower = senderEmail.toLowerCase();
              const userEmailLower = userEmail.toLowerCase();
              ccRecipients = [...new Set(ccRecipients)].filter(addr => {
                const addrEmail = addr.match(/<([^>]+)>/)?.[1]?.toLowerCase() || addr.toLowerCase();
                return addrEmail !== senderEmailLower && addrEmail !== userEmailLower;
              });

              const ccString = ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined;
              if (ccString) {
                console.log(`Reply-all CC: ${ccString}`);
              }

              draftId = await createDraft(
                user.access_token,
                user.refresh_token,
                senderEmail,
                email.subject,
                draftBody,
                email.threadId,
                ccString,   // CC for reply-all
                userEmail   // User's email to exclude from CC
              );

              console.log(`Draft created successfully with ID: ${draftId}`);

              // Increment the user's draft count
              await supabase
                .from("users")
                .update({
                  drafts_created_count: (user.drafts_created_count || 0) + 1
                })
                .eq("email", userEmail);

              // Update local user object to reflect the new count
              user.drafts_created_count = (user.drafts_created_count || 0) + 1;

            } catch (draftError: any) {
              console.error(`Failed to create draft for email ${email.id}:`, draftError);
              console.error(`Draft error details:`, draftError.message || draftError);
            }
          }
        }

        // Step 5: Save to database with classification metadata
        const { data: savedEmail, error: saveError } = await supabase
          .from("emails")
          .upsert({
            user_email: userEmail,
            gmail_id: email.id,
            subject: email.subject,
            from: email.from,
            from_email: email.fromEmail,
            body_preview: email.bodyPreview,
            category: category,
            draft_id: draftId,
            processed_at: new Date().toISOString(),
            // New classification metadata fields
            thread_id: email.threadId,
            classification_reasoning: result.reasoning,
            classification_confidence: result.confidence,
            is_thread: result.isThread,
            sender_known: result.senderKnown,
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
            draftSkippedDueToLimit,
          });
        }
      } catch (emailError) {
        console.error(`Failed to process email ${email.id}:`, emailError);
      }
    }

    // Count drafts skipped due to limit
    const draftsSkipped = results.filter(r => r.draftSkippedDueToLimit).length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      skipped: emails.length - newEmails.length,
      emails: results,
      draftsSkippedDueToLimit: draftsSkipped,
      userDraftCount: user.drafts_created_count || 0,
      draftLimitReached: (user.drafts_created_count || 0) >= FREE_DRAFT_LIMIT && user.subscription_status !== "active",
    });
  } catch (error) {
    console.error("Error processing emails:", error);
    return NextResponse.json(
      { error: "Failed to process emails" },
      { status: 500 }
    );
  }
}
