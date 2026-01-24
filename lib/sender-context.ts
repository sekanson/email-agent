/**
 * Sender Context Module
 *
 * Queries the database for previous emails from a sender to determine
 * if they are a known contact. This context helps prevent misclassifying
 * emails from known contacts as Marketing/Spam.
 */

import { createClient } from "@/lib/supabase";

export interface SenderContext {
  hasHistory: boolean;
  emailCount: number;
  previousCategories: number[];
  mostCommonCategory: number | null;
  isKnownContact: boolean; // true if 2+ previous emails
  lastInteraction: Date | null;
  daysSinceLastContact: number | null;
}

/**
 * Get context about previous emails from a sender
 *
 * @param userEmail - The user's email address (for scoping the query)
 * @param senderEmail - The sender's email address to look up
 * @returns SenderContext with history information
 */
export async function getSenderContext(
  userEmail: string,
  senderEmail: string
): Promise<SenderContext> {
  const supabase = createClient();

  // Normalize sender email to lowercase for consistent matching
  const normalizedSender = senderEmail.toLowerCase().trim();

  const { data: emails, error } = await supabase
    .from("emails")
    .select("category, processed_at, from_email")
    .eq("user_email", userEmail)
    .eq("from_email", normalizedSender)
    .order("processed_at", { ascending: false })
    .limit(50);

  // If no history or error, return empty context
  if (error || !emails || emails.length === 0) {
    return {
      hasHistory: false,
      emailCount: 0,
      previousCategories: [],
      mostCommonCategory: null,
      isKnownContact: false,
      lastInteraction: null,
      daysSinceLastContact: null,
    };
  }

  // Calculate category distribution
  const categories = emails.map((e) => e.category);
  const categoryCounts = categories.reduce(
    (acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  );

  // Find most common category
  const sortedCategories = Object.entries(categoryCounts).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );
  const mostCommonCategory = sortedCategories.length > 0
    ? parseInt(sortedCategories[0][0])
    : null;

  // Calculate days since last contact
  const lastDate = new Date(emails[0].processed_at);
  const daysSince = Math.floor(
    (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    hasHistory: true,
    emailCount: emails.length,
    previousCategories: [...new Set(categories)], // Unique categories
    mostCommonCategory,
    isKnownContact: emails.length >= 2, // At least 2 previous emails = known contact
    lastInteraction: lastDate,
    daysSinceLastContact: daysSince,
  };
}

/**
 * Format sender context for inclusion in the classification prompt
 */
export function formatSenderContextForPrompt(context: SenderContext): string {
  if (!context.hasHistory) {
    return `SENDER CONTEXT:
- First email from this sender (no history)
- Treat with appropriate caution for cold outreach`;
  }

  const categoryNames: Record<number, string> = {
    1: "Respond",
    2: "Update",
    3: "Comment",
    4: "Notification",
    5: "Calendar",
    6: "Pending",
    7: "Complete",
    8: "Marketing/Spam",
  };

  const prevCategoryNames = context.previousCategories
    .map((c) => categoryNames[c] || `Category ${c}`)
    .join(", ");

  const mostCommonName = context.mostCommonCategory
    ? categoryNames[context.mostCommonCategory] || `Category ${context.mostCommonCategory}`
    : "N/A";

  return `SENDER CONTEXT:
- ${context.emailCount} previous email(s) from this sender
- Previous categories: ${prevCategoryNames}
- Most common category: ${mostCommonName}
- Days since last contact: ${context.daysSinceLastContact}
- Known contact: ${context.isKnownContact ? "Yes" : "No"}
- IMPORTANT: This is a known sender - do NOT classify as Marketing/Spam unless clearly promotional AND unsolicited`;
}
