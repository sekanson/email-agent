import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Limits
const MAX_EMAILS_TOTAL = 5000;
const CHUNK_SIZE = 500;
const MAX_RUNTIME_MS = 120000; // 2 minutes

// Category types
type EmailCategory = "important" | "receipts" | "subscriptions" | "newsletters" | "marketing" | "notifications";

interface EmailInfo {
  gmail_id: string;
  thread_id: string;
  from: string;
  from_email: string;
  subject: string;
  date: string;
  has_unsubscribe: boolean;
  unsubscribe_link: string | null;
  has_thread: boolean;
}

// Full email info returned to client
interface CategorizedEmail {
  gmail_id: string;
  subject: string;
  from: string;
  from_email: string;
  date: string;
  category: EmailCategory;
  reason: string;
  has_thread: boolean;
  has_unsubscribe: boolean;
  unsubscribe_link: string | null;
}

// Extract email address from "Name <email>" format
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
}

// Parse List-Unsubscribe header to get the link
function parseUnsubscribeHeader(header: string | undefined): string | null {
  if (!header) return null;

  // Try to find http/https URL first (preferred)
  const httpMatch = header.match(/<(https?:\/\/[^>]+)>/);
  if (httpMatch) return httpMatch[1];

  // Try mailto as fallback
  const mailtoMatch = header.match(/<(mailto:[^>]+)>/);
  if (mailtoMatch) return mailtoMatch[1];

  return null;
}

// Pattern-based pre-classification helpers
function isReceiptSender(fromEmail: string, subject: string): boolean {
  const emailPatterns = [
    "receipt", "invoice", "order", "shipping", "tracking",
    "confirmation", "payment", "billing@", "orders@",
    "ship-confirm", "shipment", "delivery"
  ];
  const subjectPatterns = [
    "order confirmation", "your order", "order #", "receipt for",
    "invoice", "payment received", "shipping confirmation",
    "has shipped", "out for delivery", "delivered", "tracking number"
  ];

  const emailMatch = emailPatterns.some(p => fromEmail.includes(p));
  const subjectMatch = subjectPatterns.some(p => subject.toLowerCase().includes(p));
  return emailMatch || subjectMatch;
}

function isSubscriptionSender(fromEmail: string, subject: string): boolean {
  const emailPatterns = [
    "billing@", "subscription", "membership", "renewal",
    "account@netflix", "account@spotify", "billing@apple"
  ];
  const subjectPatterns = [
    "subscription", "renewal", "billing", "membership",
    "your plan", "payment due", "recurring", "auto-renewal",
    "monthly charge", "annual charge"
  ];

  const emailMatch = emailPatterns.some(p => fromEmail.includes(p));
  const subjectMatch = subjectPatterns.some(p => subject.toLowerCase().includes(p));
  return emailMatch || subjectMatch;
}

function isNewsletterSender(fromEmail: string, subject: string): boolean {
  const emailPatterns = [
    "newsletter", "digest", "weekly@", "daily@",
    "substack", "news@", "editorial"
  ];
  const subjectPatterns = [
    "newsletter", "digest", "weekly roundup", "daily brief",
    "this week in", "edition"
  ];

  const emailMatch = emailPatterns.some(p => fromEmail.includes(p));
  const subjectMatch = subjectPatterns.some(p => subject.toLowerCase().includes(p));
  return emailMatch || subjectMatch;
}

function isMarketingSender(fromEmail: string, subject: string): boolean {
  const emailPatterns = [
    "marketing", "promo", "offers@", "deals@", "sales@",
    "store@", "shop@"
  ];
  const subjectPatterns = [
    "% off", "sale", "discount", "limited time", "special offer",
    "don't miss", "exclusive deal", "flash sale", "coupon",
    "free shipping", "last chance", "ends today", "save $"
  ];

  const emailMatch = emailPatterns.some(p => fromEmail.includes(p));
  const subjectMatch = subjectPatterns.some(p => subject.toLowerCase().includes(p));
  return emailMatch || subjectMatch;
}

function isNotificationSender(fromEmail: string): boolean {
  const patterns = [
    "noreply@", "no-reply@", "notifications@", "alerts@",
    "mailer-daemon", "postmaster", "donotreply", "notify@",
    "security@", "login@", "verification@"
  ];
  return patterns.some(p => fromEmail.includes(p));
}

function hasThread(email: EmailInfo): boolean {
  const subject = email.subject.toLowerCase();
  return (
    subject.startsWith("re:") ||
    subject.startsWith("fwd:") ||
    subject.startsWith("fw:") ||
    email.has_thread
  );
}

function createCategorizedEmail(
  email: EmailInfo,
  category: EmailCategory,
  reason: string
): CategorizedEmail {
  return {
    gmail_id: email.gmail_id,
    subject: email.subject,
    from: email.from,
    from_email: email.from_email,
    date: email.date,
    category,
    reason,
    has_thread: hasThread(email),
    has_unsubscribe: email.has_unsubscribe,
    unsubscribe_link: email.unsubscribe_link,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to scan emails");
    }

    const { scanAll = false, maxEmails = 500 } = await request.json();
    const userEmail = authenticatedEmail; // Use authenticated email

    const effectiveMax = scanAll ? MAX_EMAILS_TOTAL : Math.min(maxEmails, CHUNK_SIZE);
    console.log(`[Declutter Scan] Starting scan for ${userEmail}, scanAll: ${scanAll}, effectiveMax: ${effectiveMax}`);

    const supabase = createClient();

    // Get user's OAuth tokens
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("access_token, refresh_token")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      console.error("[Declutter Scan] User not found:", userError);
      return NextResponse.json(
        { error: "User not found", details: userError?.message },
        { status: 404 }
      );
    }

    // Get known important senders from emails table (category 1-3)
    const { data: knownEmails } = await supabase
      .from("emails")
      .select("from")
      .eq("user_email", userEmail)
      .in("category", [1, 2, 3]);

    const knownSenders = new Set(
      (knownEmails || []).map((e) => extractEmail(e.from))
    );
    console.log(`[Declutter Scan] Found ${knownSenders.size} known senders`);

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

    // Get total unread count first (just the count, fast)
    let totalUnreadEstimate = 0;
    try {
      const countResponse = await gmail.users.messages.list({
        userId: "me",
        q: "is:unread",
        maxResults: 1,
      });
      totalUnreadEstimate = countResponse.data.resultSizeEstimate || 0;
      console.log(`[Declutter Scan] Estimated total unread: ${totalUnreadEstimate}`);
    } catch (countErr) {
      console.error("[Declutter Scan] Error getting count:", countErr);
    }

    // Fetch message IDs in chunks
    const allMessageIds: string[] = [];
    let pageToken: string | undefined;
    let hitTimeLimit = false;
    let hitMaxLimit = false;

    // Fetch all message IDs up to the limit
    while (allMessageIds.length < effectiveMax) {
      if (Date.now() - startTime > MAX_RUNTIME_MS * 0.3) {
        console.log("[Declutter Scan] Time limit approaching for ID fetching");
        hitTimeLimit = true;
        break;
      }

      try {
        const listResponse = await gmail.users.messages.list({
          userId: "me",
          q: "is:unread",
          maxResults: Math.min(500, effectiveMax - allMessageIds.length),
          pageToken,
        });

        const messages = listResponse.data.messages || [];
        allMessageIds.push(...messages.map((m) => m.id!));
        pageToken = listResponse.data.nextPageToken || undefined;

        console.log(`[Declutter Scan] Fetched ${allMessageIds.length} message IDs so far`);

        if (!pageToken) break;
      } catch (listErr) {
        console.error("[Declutter Scan] Error listing messages:", listErr);
        break;
      }
    }

    if (allMessageIds.length >= MAX_EMAILS_TOTAL) {
      hitMaxLimit = true;
    }

    console.log(`[Declutter Scan] Total message IDs collected: ${allMessageIds.length}`);

    if (allMessageIds.length === 0) {
      const { data: session } = await supabase
        .from("declutter_sessions")
        .insert({
          user_email: userEmail,
          total_unread: 0,
          important_count: 0,
          receipts_count: 0,
          subscriptions_count: 0,
          newsletters_count: 0,
          marketing_count: 0,
          notifications_count: 0,
          important_emails: [],
        })
        .select()
        .single();

      return NextResponse.json({
        sessionId: session?.id,
        emails: [],
        counts: {
          important: 0,
          receipts: 0,
          subscriptions: 0,
          newsletters: 0,
          marketing: 0,
          notifications: 0,
        },
        totalUnread: 0,
        totalUnreadEstimate: 0,
        scannedCount: 0,
        hasMore: false,
        isComplete: true,
        hitMaxLimit: false,
        hitTimeLimit: false,
      });
    }

    // Store ALL categorized emails
    const allEmails: CategorizedEmail[] = [];
    const uncategorizedForAI: EmailInfo[] = [];

    // Process emails in chunks
    const headerBatchSize = 50;
    let processedCount = 0;

    for (let i = 0; i < allMessageIds.length; i += headerBatchSize) {
      if (Date.now() - startTime > MAX_RUNTIME_MS * 0.7) {
        console.log("[Declutter Scan] Time limit approaching for header fetching");
        hitTimeLimit = true;
        break;
      }

      const batchIds = allMessageIds.slice(i, i + headerBatchSize);
      console.log(`[Declutter Scan] Processing headers batch ${Math.floor(i / headerBatchSize) + 1}, emails ${i + 1}-${i + batchIds.length}`);

      try {
        const batchPromises = batchIds.map((id) =>
          gmail.users.messages.get({
            userId: "me",
            id,
            format: "metadata",
            metadataHeaders: [
              "From",
              "Subject",
              "Date",
              "List-Unsubscribe",
              "References",
              "In-Reply-To",
            ],
          })
        );

        const results = await Promise.allSettled(batchPromises);

        for (const result of results) {
          if (result.status === "rejected") {
            continue;
          }

          const data = result.value.data;
          const rawHeaders = data.payload?.headers || [];
          const headers = rawHeaders.filter(
            (h): h is { name: string; value: string } =>
              typeof h.name === "string" && typeof h.value === "string"
          );

          const from = headers.find((h) => h.name === "From")?.value || "";
          const subject = headers.find((h) => h.name === "Subject")?.value || "(No subject)";
          const date = headers.find((h) => h.name === "Date")?.value || "";
          const unsubscribeHeader = headers.find(
            (h) => h.name.toLowerCase() === "list-unsubscribe"
          )?.value;
          const hasUnsubscribe = !!unsubscribeHeader;
          const unsubscribeLink = parseUnsubscribeHeader(unsubscribeHeader);
          const hasReferences =
            headers.some((h) => h.name === "References") ||
            headers.some((h) => h.name === "In-Reply-To");

          const email: EmailInfo = {
            gmail_id: data.id!,
            thread_id: data.threadId!,
            from,
            from_email: extractEmail(from),
            subject,
            date,
            has_unsubscribe: hasUnsubscribe,
            unsubscribe_link: unsubscribeLink,
            has_thread: hasReferences,
          };

          processedCount++;

          // Bucket the email using pattern matching first
          if (knownSenders.has(email.from_email)) {
            allEmails.push(createCategorizedEmail(email, "important", "Known contact"));
          } else if (isReceiptSender(email.from_email, email.subject)) {
            allEmails.push(createCategorizedEmail(email, "receipts", "Receipt/Order"));
          } else if (isSubscriptionSender(email.from_email, email.subject)) {
            allEmails.push(createCategorizedEmail(email, "subscriptions", "Subscription"));
          } else if (isNewsletterSender(email.from_email, email.subject)) {
            allEmails.push(createCategorizedEmail(email, "newsletters", "Newsletter"));
          } else if (isMarketingSender(email.from_email, email.subject)) {
            allEmails.push(createCategorizedEmail(email, "marketing", "Marketing"));
          } else if (email.has_unsubscribe) {
            // Has unsubscribe but doesn't match specific patterns - likely marketing
            allEmails.push(createCategorizedEmail(email, "marketing", "Has unsubscribe"));
          } else if (isNotificationSender(email.from_email)) {
            allEmails.push(createCategorizedEmail(email, "notifications", "Notification"));
          } else {
            // Collect for AI analysis (limit to 200)
            if (uncategorizedForAI.length < 200) {
              uncategorizedForAI.push(email);
            } else {
              // Default uncategorized to notifications
              allEmails.push(createCategorizedEmail(email, "notifications", "Uncategorized"));
            }
          }
        }
      } catch (batchErr) {
        console.error("[Declutter Scan] Batch error:", batchErr);
      }
    }

    console.log(`[Declutter Scan] Processed ${processedCount} emails. Pre-AI: ${allEmails.length} categorized, ${uncategorizedForAI.length} for AI`);

    // AI analysis for uncategorized emails (if we have time)
    if (uncategorizedForAI.length > 0 && Date.now() - startTime < MAX_RUNTIME_MS * 0.9) {
      console.log(`[Declutter Scan] AI analyzing ${uncategorizedForAI.length} uncategorized emails...`);

      const maxAIBatches = 2;
      let aiBatchCount = 0;

      for (let i = 0; i < uncategorizedForAI.length && aiBatchCount < maxAIBatches; i += 50) {
        if (Date.now() - startTime > MAX_RUNTIME_MS * 0.95) {
          console.log("[Declutter Scan] Time limit reached, skipping remaining AI analysis");
          // Add remaining to notifications
          for (let j = i; j < uncategorizedForAI.length; j++) {
            allEmails.push(createCategorizedEmail(uncategorizedForAI[j], "notifications", "Uncategorized"));
          }
          break;
        }

        const batch = uncategorizedForAI.slice(i, i + 50);
        const emailList = batch
          .map((e, idx) => `${idx + 1}. From: ${e.from}\n   Subject: ${e.subject}`)
          .join("\n\n");

        try {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            messages: [
              {
                role: "user",
                content: `Classify each email into ONE of these categories:

CATEGORIES:
- important: Personal emails, work emails, emails requiring response/action, messages from real people
- receipts: Purchase confirmations, invoices, order confirmations, shipping notifications, payment confirmations
- subscriptions: Recurring billing (Netflix, Spotify, SaaS), membership renewals, subscription confirmations
- newsletters: Content newsletters, digests, editorial content (Substack, etc.)
- marketing: Promotional emails, sales, discounts, "limited time offers", emails with unsubscribe that aren't newsletters
- notifications: Automated alerts, security notifications, login alerts, app notifications

Emails to classify:
${emailList}

Respond with JSON only:
{
  "classifications": [
    {"index": 1, "category": "important", "reason": "Brief reason"},
    {"index": 2, "category": "receipts", "reason": "Order confirmation"}
  ]
}

Include ALL emails in your response. Be strict about "important" - only truly personal/work emails that need attention.`,
              },
            ],
          });

          const textContent = response.content.find((c) => c.type === "text");
          if (textContent && textContent.type === "text") {
            const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const classifiedIndices = new Set<number>();

              for (const item of parsed.classifications || []) {
                const email = batch[item.index - 1];
                if (!email) continue;

                classifiedIndices.add(item.index - 1);
                const category = item.category as EmailCategory;
                allEmails.push(createCategorizedEmail(email, category, item.reason || "AI classified"));
              }

              // Add any unclassified emails as notifications
              batch.forEach((email, idx) => {
                if (!classifiedIndices.has(idx)) {
                  allEmails.push(createCategorizedEmail(email, "notifications", "Uncategorized"));
                }
              });
            }
          }
          aiBatchCount++;
        } catch (err) {
          console.error("[Declutter Scan] AI analysis error:", err);
          // On error, add batch to notifications
          for (const email of batch) {
            allEmails.push(createCategorizedEmail(email, "notifications", "Uncategorized"));
          }
        }
      }
    } else if (uncategorizedForAI.length > 0) {
      // No time for AI, add remaining to notifications
      for (const email of uncategorizedForAI) {
        allEmails.push(createCategorizedEmail(email, "notifications", "Uncategorized"));
      }
    }

    // Calculate counts
    const counts = {
      important: allEmails.filter(e => e.category === "important").length,
      receipts: allEmails.filter(e => e.category === "receipts").length,
      subscriptions: allEmails.filter(e => e.category === "subscriptions").length,
      newsletters: allEmails.filter(e => e.category === "newsletters").length,
      marketing: allEmails.filter(e => e.category === "marketing").length,
      notifications: allEmails.filter(e => e.category === "notifications").length,
    };

    const isComplete = !hitTimeLimit && !hitMaxLimit && processedCount >= allMessageIds.length;

    // Save session to database (store all emails for session recovery)
    const { data: session, error: sessionError } = await supabase
      .from("declutter_sessions")
      .insert({
        user_email: userEmail,
        total_unread: totalUnreadEstimate,
        important_count: counts.important,
        receipts_count: counts.receipts,
        subscriptions_count: counts.subscriptions,
        newsletters_count: counts.newsletters,
        marketing_count: counts.marketing,
        notifications_count: counts.notifications,
        important_emails: allEmails, // Store all emails now
      })
      .select()
      .single();

    if (sessionError) {
      console.error("[Declutter Scan] Error saving session:", sessionError);
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[Declutter Scan] Complete in ${elapsedMs}ms. Session ID: ${session?.id}`);

    return NextResponse.json({
      sessionId: session?.id,
      emails: allEmails,
      counts,
      totalUnread: totalUnreadEstimate,
      scannedCount: processedCount,
      hasMore: totalUnreadEstimate > processedCount,
      isComplete,
      hitMaxLimit,
      hitTimeLimit,
      elapsedMs,
    });
  } catch (error) {
    console.error("[Declutter Scan] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Failed to scan emails",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
