import { NextRequest, NextResponse } from "next/server";
import { getEmails, applyLabel, createDraft, refreshAccessToken, getThreadMessages, formatThreadForAI } from "@/lib/gmail";
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

// Maximum emails to process per user per cron run
const MAX_EMAILS_PER_USER = 10;

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET environment variable not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("Invalid cron authorization");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = createClient();

    // Fetch all users who have:
    // 1. Set up their Gmail labels
    // 2. Have a refresh token (so we can refresh their access)
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
      .eq("labels_created", true)
      .not("refresh_token", "is", null);

    if (usersError) {
      console.error("Failed to fetch users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users to process",
        usersProcessed: 0,
        totalEmailsProcessed: 0,
      });
    }

    const results: {
      userEmail: string;
      emailsProcessed: number;
      draftsCreated: number;
      error?: string;
    }[] = [];

    // Process each user
    for (const user of users) {
      try {
        // Get user settings - try user_email first, then email
        let { data: settings } = await supabase
          .from("user_settings")
          .select("*")
          .eq("user_email", user.email)
          .single();

        if (!settings) {
          const result = await supabase
            .from("user_settings")
            .select("*")
            .eq("email", user.email)
            .single();
          settings = result.data;
        }

        // Skip users who have explicitly disabled auto-polling
        if (settings && settings.auto_poll_enabled === false) {
          console.log(`Skipping ${user.email} - auto-polling disabled`);
          continue;
        }

        // Refresh the access token
        let accessToken = user.access_token;
        try {
          accessToken = await refreshAccessToken(user.refresh_token);

          // Update the user's access token in the database
          await supabase
            .from("users")
            .update({
              access_token: accessToken,
              updated_at: new Date().toISOString(),
            })
            .eq("email", user.email);
        } catch (refreshError) {
          console.error(`Failed to refresh token for ${user.email}:`, refreshError);
          results.push({
            userEmail: user.email,
            emailsProcessed: 0,
            draftsCreated: 0,
            error: "Token refresh failed",
          });
          continue;
        }

        const temperature = settings?.temperature || 0.7;
        const signature = settings?.signature || "";
        const draftsEnabled = settings?.drafts_enabled ?? true;
        const categories: Record<string, CategoryConfig> =
          settings?.categories || DEFAULT_CATEGORIES;
        const writingStyle =
          settings?.use_writing_style && settings?.writing_style
            ? settings.writing_style
            : "";

        // Get already processed email IDs
        const { data: processedEmails } = await supabase
          .from("emails")
          .select("gmail_id")
          .eq("user_email", user.email);

        const processedIds = new Set(
          (processedEmails || []).map((e) => e.gmail_id)
        );

        // Fetch unread emails from Gmail
        const emails = await getEmails(
          accessToken,
          user.refresh_token,
          MAX_EMAILS_PER_USER,
          "is:unread"
        );

        // Filter out already processed emails
        const newEmails = emails.filter((e) => !processedIds.has(e.id));

        let emailsProcessed = 0;
        let draftsCreated = 0;
        let currentDraftCount = user.drafts_created_count || 0;

        for (const email of newEmails) {
          try {
            // Get sender context for enhanced classification
            const senderContext = await getSenderContext(user.email, email.fromEmail);

            // Classify the email
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

            // Apply the label
            const categoryConfig = categories[category.toString()];
            const categoryName = categoryConfig?.name;
            const labelId = categoryName
              ? user.gmail_label_ids[categoryName]
              : null;

            if (labelId) {
              await applyLabel(accessToken, user.refresh_token, email.id, labelId);
            }

            // Generate draft for "To Respond" emails (category 1)
            let draftId = null;
            const canCreateDraft =
              user.subscription_status === "active" ||
              currentDraftCount < FREE_DRAFT_LIMIT;

            if (category === 1 && draftsEnabled && canCreateDraft) {
              try {
                const senderMatch = email.from.match(/<([^>]+)>/) || [
                  null,
                  email.from,
                ];
                const senderEmail = senderMatch[1] || email.from;

                // Fetch full thread context for better responses
                let threadContext = "";
                try {
                  const threadMessages = await getThreadMessages(
                    accessToken,
                    user.refresh_token,
                    email.threadId,
                    user.email
                  );
                  threadContext = formatThreadForAI(threadMessages);
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

                // Build CC list for reply-all
                let ccRecipients: string[] = [];
                if (email.cc) {
                  ccRecipients.push(...email.cc.split(',').map(addr => addr.trim()));
                }
                if (email.to) {
                  ccRecipients.push(...email.to.split(',').map(addr => addr.trim()));
                }

                // Filter: remove sender and user's own email
                const senderEmailLower = senderEmail.toLowerCase();
                const userEmailLower = user.email.toLowerCase();
                ccRecipients = [...new Set(ccRecipients)].filter(addr => {
                  const addrEmail = addr.match(/<([^>]+)>/)?.[1]?.toLowerCase() || addr.toLowerCase();
                  return addrEmail !== senderEmailLower && addrEmail !== userEmailLower;
                });

                const ccString = ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined;

                draftId = await createDraft(
                  accessToken,
                  user.refresh_token,
                  senderEmail,
                  email.subject,
                  draftBody,
                  email.threadId,
                  ccString,    // CC for reply-all
                  user.email   // User's email to exclude from CC
                );

                // Increment draft count
                currentDraftCount++;
                await supabase
                  .from("users")
                  .update({
                    drafts_created_count: currentDraftCount,
                  })
                  .eq("email", user.email);

                draftsCreated++;
              } catch (draftError) {
                console.error(
                  `Failed to create draft for ${user.email}:`,
                  draftError
                );
              }
            }

            // Save to database
            await supabase.from("emails").upsert({
              user_email: user.email,
              gmail_id: email.id,
              subject: email.subject,
              from: email.from,
              from_email: email.fromEmail,
              body_preview: email.bodyPreview,
              category: category,
              draft_id: draftId,
              processed_at: new Date().toISOString(),
              thread_id: email.threadId,
              classification_reasoning: result.reasoning,
              classification_confidence: result.confidence,
              is_thread: result.isThread,
              sender_known: result.senderKnown,
            });

            emailsProcessed++;
          } catch (emailError) {
            console.error(
              `Failed to process email ${email.id} for ${user.email}:`,
              emailError
            );
          }
        }

        // Update user's last processed timestamp
        await supabase
          .from("users")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("email", user.email);

        results.push({
          userEmail: user.email,
          emailsProcessed,
          draftsCreated,
        });
      } catch (userError) {
        console.error(`Failed to process user ${user.email}:`, userError);
        results.push({
          userEmail: user.email,
          emailsProcessed: 0,
          draftsCreated: 0,
          error: userError instanceof Error ? userError.message : "Unknown error",
        });
      }
    }

    const totalEmailsProcessed = results.reduce(
      (sum, r) => sum + r.emailsProcessed,
      0
    );
    const totalDraftsCreated = results.reduce(
      (sum, r) => sum + r.draftsCreated,
      0
    );
    const usersWithErrors = results.filter((r) => r.error).length;

    console.log(
      `Cron completed: ${results.length} users, ${totalEmailsProcessed} emails, ${totalDraftsCreated} drafts`
    );

    return NextResponse.json({
      success: true,
      usersProcessed: results.length,
      totalEmailsProcessed,
      totalDraftsCreated,
      usersWithErrors,
      details: results,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
