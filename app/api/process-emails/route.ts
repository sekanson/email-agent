import { NextRequest, NextResponse } from "next/server";
import { getEmails, replaceCategoryLabelOnThread, createDraft, getThreadMessages, formatThreadForAI } from "@/lib/gmail";
import {
  classifyEmailWithContext,
  generateDraftResponse,
  DEFAULT_CATEGORIES,
  CategoryConfig,
  ClassificationResult,
} from "@/lib/claude";
import { createClient } from "@/lib/supabase";
import { getSenderContext } from "@/lib/sender-context";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

// Free tier limit for drafts
const FREE_DRAFT_LIMIT = 10;

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to process emails");
    }

    const { maxEmails = 10 } = await request.json();
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

    if (!user.labels_created) {
      return NextResponse.json(
        { error: "Please setup Gmail labels first" },
        { status: 400 }
      );
    }

    // Refresh the access token before making Gmail API calls
    let accessToken = user.access_token;
    try {
      const { refreshAccessToken } = await import("@/lib/gmail");
      accessToken = await refreshAccessToken(user.refresh_token);

      // Update stored token
      await supabase
        .from("users")
        .update({ access_token: accessToken, updated_at: new Date().toISOString() })
        .eq("email", userEmail);

      console.log(`[${userEmail}] Access token refreshed successfully`);
    } catch (refreshError) {
      console.error(`[${userEmail}] Token refresh failed:`, refreshError);
      // Continue with existing token, might still work
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

    // Fetch recent emails from inbox (not just unread - handles case where user reads quickly)
    // Using newer_than:1d to catch emails from the last 24 hours
    const emails = await getEmails(
      accessToken,
      user.refresh_token,
      maxEmails,
      "in:inbox newer_than:1d"
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
            to: email.to,
            cc: email.cc,
          },
          senderContext,
          categories,
          userEmail
        );

        const category = result.category;

        // Step 3: Apply the label (if labeling is enabled for this category)
        // Look up the category name from the category number
        const categoryConfig = categories[category.toString()];
        const categoryName = categoryConfig?.name;
        // Check if labeling is enabled for this category (default: true if not specified)
        const labelingEnabled = categoryConfig?.labelEnabled !== false;
        // gmail_label_ids is now keyed by category NAME, not number
        const labelId = (categoryName && labelingEnabled) ? user.gmail_label_ids?.[categoryName] : null;

        // Enhanced logging for label application
        const labelingInfo = {
          emailId: email.id,
          subject: email.subject.slice(0, 50),
          category,
          categoryName,
          labelId,
          availableLabels: Object.keys(user.gmail_label_ids || {}),
          confidence: result.confidence,
          reasoning: result.reasoning,
        };
        console.log(`[${userEmail}] Classification:`, JSON.stringify(labelingInfo));

        if (labelId) {
          try {
            // Get all category label IDs for removing old labels
            const allCategoryLabelIds = Object.values(user.gmail_label_ids || {}).filter(Boolean) as string[];

            // Replace label on ENTIRE THREAD - removes any existing category labels from all messages
            // and applies the new one to all messages, so the thread has ONE consistent label
            await replaceCategoryLabelOnThread(
              accessToken,
              user.refresh_token,
              email.threadId,  // Use threadId, not messageId
              labelId,
              allCategoryLabelIds
            );
            console.log(`[${userEmail}] ✓ Label "${categoryName}" (${labelId}) applied to thread ${email.threadId}`);
          } catch (labelError: any) {
            console.error(`[${userEmail}] ✗ Failed to apply label to thread ${email.threadId}:`, labelError.message || labelError);
            // Log more details for debugging
            console.error(`[${userEmail}] Label error details:`, {
              labelId,
              threadId: email.threadId,
              error: labelError.response?.data || labelError.message,
            });
          }
        } else if (!labelingEnabled) {
          // Labeling is intentionally disabled for this category
          console.log(`[${userEmail}] ℹ Label skipped for category ${category} "${categoryName}" (labeling disabled by user)`);
        } else {
          // This is a problem - email classified but not labeled!
          console.error(`[${userEmail}] ⚠ EMAIL NOT LABELED - No labelId found!`, {
            emailId: email.id,
            subject: email.subject,
            category,
            categoryName,
            gmailLabelIds: user.gmail_label_ids,
            labelsCreated: user.labels_created,
          });
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
                  accessToken,
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
                threadContext,  // Pass thread context to AI
                userEmail  // Pass user email so AI knows who is replying
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
                accessToken,
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
