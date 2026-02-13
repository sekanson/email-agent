import { NextRequest, NextResponse } from "next/server";
import { getEmails } from "@/lib/gmail";
import {
  classifyEmailWithContext,
  DEFAULT_CATEGORIES,
  CategoryConfig,
} from "@/lib/claude";
import { createClient } from "@/lib/supabase";
import { getSenderContext } from "@/lib/sender-context";
import { DigestEmail, generateSuggestedActions } from "@/lib/zeno-digest";
import { createAction, updateSenderHistory } from "@/lib/action-queue";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

/**
 * POST /api/zeno/scan
 *
 * Scans the user's inbox for important emails that need attention.
 * Returns emails prioritized by importance with suggested actions.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in to scan emails");
    }

    const { maxEmails = 20, includeRead = false } = await request.json();
    const userEmail = authenticatedEmail; // Use authenticated email

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

    // Get user settings for categories
    let { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    const categories: Record<string, CategoryConfig> =
      settings?.categories || DEFAULT_CATEGORIES;

    // Fetch emails from Gmail
    const query = includeRead ? "" : "is:unread";
    const emails = await getEmails(
      user.access_token,
      user.refresh_token,
      maxEmails,
      query
    );

    // Get already processed email IDs to avoid duplicates
    const { data: processedEmails } = await supabase
      .from("emails")
      .select("gmail_id, category")
      .eq("user_email", userEmail);

    const processedMap = new Map(
      (processedEmails || []).map((e) => [e.gmail_id, e.category])
    );

    // Classify and analyze each email
    const digestEmails: DigestEmail[] = [];
    const newlyProcessed: string[] = [];

    for (const email of emails) {
      try {
        // Check if already processed
        const existingCategory = processedMap.get(email.id);
        let classification;

        if (existingCategory !== undefined) {
          // Use cached classification
          classification = {
            category: existingCategory,
            confidence: 1.0,
            reasoning: "Previously classified",
            isThread: false,
            senderKnown: true,
          };
        } else {
          // Get sender context and classify
          const senderContext = await getSenderContext(userEmail, email.fromEmail);
          classification = await classifyEmailWithContext(
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

          // Update sender history
          await updateSenderHistory(
            userEmail,
            email.fromEmail,
            email.from.replace(/<[^>]+>/, "").trim(),
            classification.category
          );

          newlyProcessed.push(email.id);
        }

        // Build digest email object
        const digestEmail: DigestEmail = {
          id: email.id,
          from: email.from,
          subject: email.subject,
          bodyPreview: email.bodyPreview || email.body?.slice(0, 300) || "",
          classification,
          suggestedActions: [],
          receivedAt: new Date(email.date),
        };

        // Generate suggested actions
        digestEmail.suggestedActions = generateSuggestedActions(digestEmail);

        digestEmails.push(digestEmail);
      } catch (emailError) {
        console.error(`Failed to process email ${email.id}:`, emailError);
      }
    }

    // Sort by priority (category 1 = Respond first, then 5 = Calendar, etc.)
    const priorityOrder = [1, 5, 6, 3, 2, 4, 7, 8];
    digestEmails.sort((a, b) => {
      const aPriority = priorityOrder.indexOf(a.classification.category);
      const bPriority = priorityOrder.indexOf(b.classification.category);
      return aPriority - bPriority;
    });

    // Filter to important emails (categories that need attention)
    const importantEmails = digestEmails.filter((e) =>
      [1, 5, 6].includes(e.classification.category)
    );

    // Stats
    const stats = {
      total: digestEmails.length,
      respond: digestEmails.filter((e) => e.classification.category === 1).length,
      calendar: digestEmails.filter((e) => e.classification.category === 5).length,
      pending: digestEmails.filter((e) => e.classification.category === 6).length,
      other: digestEmails.filter((e) => ![1, 5, 6].includes(e.classification.category)).length,
      newlyClassified: newlyProcessed.length,
    };

    return NextResponse.json({
      success: true,
      stats,
      important: importantEmails,
      all: digestEmails,
    });
  } catch (error) {
    console.error("Error scanning emails:", error);
    return NextResponse.json(
      { error: "Failed to scan emails" },
      { status: 500 }
    );
  }
}
