import Anthropic from "@anthropic-ai/sdk";
import { detectThreadSignals, ThreadSignals, analyzeThreadState } from "./thread-detection";
import { SenderContext, formatSenderContextForPrompt } from "./sender-context";
import { DEFAULT_CATEGORIES as SHARED_CATEGORIES, CategoryConfig as SharedCategoryConfig } from "./categories";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Enhanced classification result with metadata
 */
export interface ClassificationResult {
  category: number;
  confidence: number;
  reasoning: string;
  isThread: boolean;
  senderKnown: boolean;
}

export interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
  required?: boolean;
  description: string;
  rules?: string;
  drafts?: boolean;
  labelEnabled?: boolean;  // Whether to apply Gmail label for this category (default: true)
  order: number;
}

// Helper functions for prefix management
export function getPrefixedName(name: string, order: number): string {
  // Don't double-prefix
  if (/^\d+:\s/.test(name)) {
    return `${order}: ${getDisplayName(name)}`;
  }
  return `${order}: ${name}`;
}

export function getDisplayName(prefixedName: string): string {
  // Remove prefix: "1: Respond" → "Respond"
  return prefixedName.replace(/^\d+:\s*/, "");
}

export function isOtherCategory(name: string): boolean {
  const displayName = getDisplayName(name);
  return displayName === "Other";
}

export function isRespondCategory(name: string): boolean {
  const displayName = getDisplayName(name).toLowerCase();
  return displayName === "respond" || displayName === "to respond" || displayName === "reply needed" || displayName.includes("reply needed");
}

export function isReceiptsCategory(name: string): boolean {
  const displayName = getDisplayName(name).toLowerCase();
  return displayName === "receipts" || displayName.includes("receipt");
}

export function isSpamCategory(name: string): boolean {
  const displayName = getDisplayName(name).toLowerCase();
  return displayName === "spam" || displayName.includes("spam");
}

export function isNewslettersCategory(name: string): boolean {
  const displayName = getDisplayName(name).toLowerCase();
  return displayName === "newsletters" || displayName.includes("newsletter");
}

export function isCalendarCategory(name: string): boolean {
  const displayName = getDisplayName(name).toLowerCase();
  return displayName === "calendar" || displayName.includes("calendar");
}

// Use shared categories from categories.ts as single source of truth
// This ensures classification and labels match
export const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = SHARED_CATEGORIES;

export const OTHER_CATEGORY: CategoryConfig = {
  name: "Other",
  color: "#9CA3AF",
  enabled: true,
  required: true,
  description: "Catch-all for uncategorized emails",
  rules: "",
  drafts: false,
  order: 99,
};

// Helper to build category context for AI prompt
function buildCategoryContext(category: CategoryConfig): string {
  const displayName = getDisplayName(category.name);
  let context = `${displayName}: ${category.description}`;
  if (category.rules && category.rules.trim()) {
    context += ` | Additional rules: ${category.rules}`;
  }
  return context;
}

// Helper to find category number by name pattern
function findCategoryByPattern(categories: Record<string, CategoryConfig>, patterns: string[]): string | null {
  for (const [num, config] of Object.entries(categories)) {
    const name = getDisplayName(config.name).toLowerCase();
    const desc = config.description.toLowerCase();
    for (const pattern of patterns) {
      if (name.includes(pattern) || desc.includes(pattern)) {
        return num;
      }
    }
  }
  return null;
}

export async function classifyEmailCategory(
  from: string,
  subject: string,
  body: string,
  categories: Record<string, CategoryConfig> = DEFAULT_CATEGORIES
): Promise<number> {
  // Build dynamic category list from user settings with descriptions and rules
  const sortedCategories = Object.entries(categories)
    .filter(([, config]) => config.enabled)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  // Build category list with descriptions and rules
  const categoryList = sortedCategories
    .map(([num, config]) => `${num}. ${buildCategoryContext(config)}`)
    .join("\n");

  const maxCategory = Math.max(
    ...Object.keys(categories).map((n) => parseInt(n))
  );

  // Check if "Other" category exists
  const hasOther = sortedCategories.some(([, config]) => isOtherCategory(config.name));

  // Find category numbers dynamically
  const marketingCat = findCategoryByPattern(categories, ["marketing", "spam", "promotional"]) || "8";
  const actionCat = findCategoryByPattern(categories, ["action", "reply", "respond"]) || "1";
  const fyiCat = findCategoryByPattern(categories, ["fyi", "info", "for info"]) || "2";
  const notificationsCat = findCategoryByPattern(categories, ["notification", "automated"]) || "4";
  const meetingsCat = findCategoryByPattern(categories, ["meeting", "calendar", "event"]) || "5";
  const waitingCat = findCategoryByPattern(categories, ["waiting", "pending", "await"]) || "6";
  const completedCat = findCategoryByPattern(categories, ["completed", "done", "resolved", "actioned"]) || "7";

  const prompt = `Classify this email into exactly ONE category. Respond with ONLY the category number.

Categories:
${categoryList}

=== STEP 1: CHECK FOR MARKETING/NEWSLETTERS FIRST (category ${marketingCat}) ===

Before anything else, check these MARKETING signals. If ANY match → Marketing (${marketingCat}):

INSTANT MARKETING (any ONE of these = Marketing):
✗ Contains "Unsubscribe" or "unsubscribe" anywhere
✗ Contains "View in browser" or "View online"
✗ Contains "Email preferences" or "Manage preferences"
✗ From a noreply@ or no-reply@ address
✗ From newsletter@, news@, marketing@, promotions@, updates@
✗ Sender is a company/brand (not a person's name)
✗ Subject contains: "Newsletter", "Weekly", "Monthly", "Digest", "Update from"
✗ Contains: "©", "All rights reserved", "Privacy Policy" links
✗ HTML-heavy email with images, buttons, multiple columns
✗ Promotional language: "% off", "sale", "limited time", "exclusive", "deal"
✗ Product announcements, feature updates, "What's new"
✗ Holiday promos: Valentine's, Black Friday, Christmas, etc.

COLD OUTREACH / SALES SPAM (any ONE of these = Marketing):
✗ Unknown sender pitching a product or service you never asked about
✗ "We built", "I wanted to reach out", "I'm reaching out", "thought you might be interested"
✗ "Let me know if you'd be interested", "Would you be open to", "quick question" (but it's a sales pitch)
✗ "Schedule a demo", "book a call", "15 minutes of your time"
✗ Sender from a company you've NEVER interacted with before
✗ Generic personalization (just your first name, no real context about you)
✗ Clickable CTA buttons like "Yes I'm interested" / "Not interested" / "Schedule demo"
✗ Pitching B2B tools, software, services, or "solutions"
✗ Sender email from unusual domains (.help, .io, .ai from unknown companies)
✗ "Your team", "your company" but they don't actually know your company
✗ Claims to solve a problem you never mentioned having

If ANY of the above match → STOP and return ${marketingCat}

=== STEP 2: IF NOT MARKETING, CLASSIFY ===

★ ACTION REQUIRED (${actionCat}) - Direct personal ask to YOU
   - Direct question to YOU (not rhetorical/broadcast)
   - Request for YOUR specific input/approval/decision
   - From a real person (colleague, client, friend)
   - Addressed personally ("Hi [name]", not "Dear valued customer")

★ FYI (${fyiCat}) - Personal informational (NOT broadcasts)
   - 1:1 status update from a colleague or real person
   - "Just letting you know" from someone you work with
   - "Thanks!" reply in a personal conversation
   - MUST be from a real person, not a company

★ NOTIFICATIONS (${notificationsCat}) - Automated transactional
   - Payment/order confirmations, receipts
   - Shipping notifications
   - Security alerts, password resets
   - GitHub/Jira/system notifications

★ MEETINGS (${meetingsCat}) - Calendar/Events/Appointments
   - Meeting invites with date/time
   - Calendar event updates, RSVPs
   - ANY mention of "Google Calendar" or "On your calendar"
   - Appointment reminders (haircut, doctor, restaurant, etc.)
   - Booking confirmations with scheduled times
   - Words like: "appointment", "scheduled", "booking", "reservation"

★ WAITING (${waitingCat}) - Awaiting someone else
   - You submitted something, waiting for response
   - Pending approval from others

★ COMPLETED (${completedCat}) - ONLY for truly closed conversations
   - Final "Thank you" that ends a thread
   - "Done!" confirmation from a person
   - NEVER use for random emails or newsletters!

⚠️ CRITICAL RULES:
- MANDATORY: Every email MUST be labeled. Never skip classification.
- Calendar keywords ("Google Calendar", "appointment", "scheduled") → Meetings (${meetingsCat})
- When in doubt between FYI and Marketing:
  - If it has "Unsubscribe" → Marketing (${marketingCat})
  - If sender is a company → Marketing (${marketingCat})
  - If it's a broadcast → Marketing (${marketingCat})
- If truly uncertain, default to Notifications (${notificationsCat})

${hasOther ? 'Use "Other" (99) only if truly unclassifiable.' : ''}

Email:
From: ${from}
Subject: ${subject}
Body: ${body.slice(0, 2000)}

Category number (1-${maxCategory}${hasOther ? ' or 99' : ''}):`;


  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 10,
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
    return 2; // Default to second category
  }

  const num = parseInt(content.text.trim(), 10);
  if (num >= 1 && num <= maxCategory && categories[num.toString()]) {
    return num;
  }

  // Default to category 2 (usually Update/Other) if parsing fails
  return Object.keys(categories).length >= 2 ? 2 : 1;
}

// Response style configuration
type ResponseStyle = "concise" | "balanced" | "detailed";

interface StyleConfig {
  temperature: number;
  lengthInstruction: string;
  maxTokens: number;
}

const STYLE_CONFIGS: Record<ResponseStyle, StyleConfig> = {
  concise: {
    temperature: 0.3,
    lengthInstruction: "Keep your response to 2-4 sentences MAXIMUM. Be direct and to the point. No filler, but STILL use proper email formatting with greeting, spacing, and sign-off.",
    maxTokens: 250,
  },
  balanced: {
    temperature: 0.5,
    lengthInstruction: "Write a response of 4-6 sentences. Cover the key points naturally. Use proper paragraph breaks and professional email formatting.",
    maxTokens: 450,
  },
  detailed: {
    temperature: 0.7,
    lengthInstruction: "Provide a thorough response of 6+ sentences as needed. Fully address all aspects with well-organized paragraphs and clear structure.",
    maxTokens: 1000,
  },
};

// Map temperature value to response style (for backward compatibility)
function getStyleFromTemp(temp: number): ResponseStyle {
  if (temp <= 0.4) return "concise";
  if (temp <= 0.6) return "balanced";
  return "detailed";
}

export async function generateDraftResponse(
  from: string,
  subject: string,
  body: string,
  temperature: number = 0.5,
  signature: string = "",
  writingStyle: string = "",
  threadContext: string = "",  // Full conversation history for context
  userEmail: string = ""  // The user's email (who is replying)
): Promise<string> {
  // Determine response style from temperature
  const style = getStyleFromTemp(temperature);
  const config = STYLE_CONFIGS[style];

  const styleInstruction = writingStyle
    ? `\n- IMPORTANT: Match this writing style: ${writingStyle}`
    : "";

  // Include thread context if available
  const threadSection = threadContext
    ? `\n${threadContext}\n=== LATEST MESSAGE (reply to this) ===\n`
    : "";

  const threadInstruction = threadContext
    ? "\n- Consider the FULL conversation history above when crafting your response"
    : "";

  // Extract sender name for context
  const senderName = from.split('<')[0].trim() || from.split('@')[0];

  const prompt = `You are drafting an email reply on behalf of a user.

IMPORTANT CONTEXT:
- The USER received this email and needs to respond
- You are writing a reply FROM the user TO ${senderName}
- Write as if YOU are the user replying to this message
- Do NOT write from ${senderName}'s perspective - they sent the email, you're replying to them
${threadSection}
EMAIL RECEIVED:
From: ${from}
Subject: ${subject}
Body:
${body.slice(0, 3000)}

Instructions:
- ${config.lengthInstruction}
- Write a helpful, professional response FROM the user's perspective
- You are REPLYING to ${senderName}, not writing as them
- Match the tone of the original email${styleInstruction}${threadInstruction}

PROFESSIONAL EMAIL FORMATTING (ALWAYS apply unless writing style explicitly overrides):
- Start with a greeting line (e.g., "Hi ${senderName}," or "Hey ${senderName},")
- Add a blank line after the greeting
- Use proper paragraph breaks - separate distinct thoughts with blank lines
- Keep paragraphs short and scannable (2-4 sentences max per paragraph)
- If listing items, use a blank line before the list
- End with a closing thought or next step before sign-off
- Add a blank line before sign-off (e.g., "Best," or "Thanks,")
- NEVER write a wall of text - proper spacing is essential for readability

- Do NOT include a subject line
- Do NOT include the signature itself (that will be added separately after sign-off)
- If you need information from the user to complete the response, add a placeholder like [PLEASE ADD: specific info needed]

Write ONLY the email body text with proper formatting (remember: you're the USER replying TO ${senderName}):`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  let draft = content.text.trim();

  // Add signature if provided
  if (signature) {
    draft += `\n\n${signature}`;
  }

  return draft;
}

/**
 * Build the tiered classification prompt with thread and sender context
 */
function buildTieredPrompt(
  email: { from: string; subject: string; body: string },
  senderContext: SenderContext,
  threadSignals: ThreadSignals,
  categories: Record<string, CategoryConfig>
): string {
  const sortedCategories = Object.entries(categories)
    .filter(([, config]) => config.enabled)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  const categoryList = sortedCategories
    .map(([num, config]) => `${num}. ${buildCategoryContext(config)}`)
    .join("\n");

  const maxCategory = Math.max(
    ...Object.keys(categories).map((n) => parseInt(n))
  );

  const hasOther = sortedCategories.some(([, config]) =>
    isOtherCategory(config.name)
  );

  // Find category numbers dynamically
  const marketingCat = findCategoryByPattern(categories, ["marketing", "spam", "promotional"]) || "8";
  const actionCat = findCategoryByPattern(categories, ["action", "reply", "respond"]) || "1";
  const fyiCat = findCategoryByPattern(categories, ["fyi", "info", "for info"]) || "2";
  const notificationsCat = findCategoryByPattern(categories, ["notification", "automated"]) || "4";
  const meetingsCat = findCategoryByPattern(categories, ["meeting", "calendar", "event"]) || "5";
  const waitingCat = findCategoryByPattern(categories, ["waiting", "pending", "await"]) || "6";
  const completedCat = findCategoryByPattern(categories, ["completed", "done", "resolved", "actioned"]) || "7";
  const teamCat = findCategoryByPattern(categories, ["team", "mention", "cc"]) || "3";

  // Build context sections
  let contextSection = "";

  if (threadSignals.isThread) {
    const threadState = analyzeThreadState(email.body, email.subject);
    contextSection += `
THREAD CONTEXT (Tier 0 - Check First):
- This is a REPLY or FORWARDED email
- Thread signals detected: ${threadSignals.signals.join(", ")}
- Thread confidence: ${(threadSignals.confidence * 100).toFixed(0)}%
- Thread state analysis: ${threadState}
- CRITICAL: Reply threads should NEVER be classified as Marketing/Spam
- Classify based on the conversation state, not promotional-sounding content
`;
  }

  contextSection += "\n" + formatSenderContextForPrompt(senderContext);

  return `Classify this email using TIERED analysis. Respond in this exact format:
CATEGORY: [number]
CONFIDENCE: [0.0-1.0]
REASONING: [one sentence explanation]

=== TIER 0: THREAD CHECK ===
${threadSignals.isThread ? `This is a REPLY thread. Never classify as Marketing unless it's clearly a marketing reply.` : "Not a thread."}

=== TIER 1: INSTANT MARKETING CHECK (${marketingCat}) - MANDATORY FIRST ===

Check these signals FIRST. If ANY match → Marketing (${marketingCat}):

MARKETING SIGNALS (any ONE = Marketing):
✗ Contains "Unsubscribe" or "unsubscribe" link
✗ Contains "View in browser" or "View online"
✗ Contains "Email preferences" or "Manage preferences"
✗ From noreply@, no-reply@, newsletter@, news@, marketing@
✗ Sender is a company/brand name (not a person's name)
✗ Subject has: "Newsletter", "Weekly", "Monthly", "Digest"
✗ Contains ©, "All rights reserved", privacy policy links
✗ Promotional: "% off", "sale", "deal", "limited time"
✗ Product announcements, "What's new", feature updates
✗ Holiday promos: Valentine's, Black Friday, etc.

COLD OUTREACH / SALES SPAM (any ONE = Marketing):
✗ Unknown sender pitching a product/service you never asked about
✗ "We built", "I wanted to reach out", "thought you might be interested"
✗ "Let me know if you'd be interested", "Would you be open to"
✗ "Schedule a demo", "book a call", "15 minutes of your time"
✗ First-time sender from a company you've NEVER interacted with
✗ Generic personalization (just first name, no real context)
✗ CTA buttons like "Yes I'm interested" / "Schedule demo"
✗ Pitching B2B tools, software, services, "solutions"
✗ Claims to solve problems you never mentioned having

If ANY match and NOT a reply thread → return ${marketingCat} immediately.

=== TIER 2: CALENDAR & TRANSACTIONAL CHECK ===

★ MEETINGS & EVENTS (${meetingsCat}) - Calendar/Appointments - CHECK FIRST
  - Any mention of "Google Calendar", "On your calendar", "calendar event"
  - Appointment reminders with specific date/time
  - Meeting invites, RSVPs, calendar updates
  - Booking confirmations (haircuts, doctor, restaurant, etc.)
  - Event tickets, reservations with scheduled times
  - Contains words like: "appointment", "scheduled", "booking", "reservation", "upcoming"
  - Reminder emails about future events
  - If it mentions a specific future date/time for something you need to attend → MEETINGS (${meetingsCat})

★ NOTIFICATIONS (${notificationsCat}) - Automated transactional (non-calendar)
  - Payment/order/shipping confirmations (no scheduled appointment)
  - Security alerts, password resets
  - GitHub/Jira/system notifications

=== TIER 3: PERSONAL EMAILS ===

★ ACTION REQUIRED (${actionCat}) - Direct ask to YOU
  - Direct question for YOUR answer (not broadcast)
  - Request for YOUR specific approval/input
  - From a real person, addressed to you personally

★ TEAM UPDATES (${teamCat}) - CC'd/mentioned
  - You're CC'd, not primary recipient
  - @mentioned but not main addressee

★ FYI (${fyiCat}) - Personal informational ONLY
  - 1:1 status update from a colleague
  - "Just letting you know" from someone you work with
  - MUST be from a real person, NOT a company

★ WAITING (${waitingCat}) - Ball in someone else's court
  - You submitted something, awaiting response

★ COMPLETED (${completedCat}) - TRULY closed conversations only
  - Final "Thank you" ending a thread
  - "Done!" from a person closing a task
  - NEVER for random emails or newsletters!

${hasOther ? `Use "Other" (99) only if truly unclassifiable.` : ""}

Categories:
${categoryList}
${contextSection}

⚠️ CLASSIFICATION RULES:
- MANDATORY: Every email MUST receive a category. Never leave an email unlabeled.
- Calendar keywords ("Google Calendar", "appointment", "scheduled", "booking") → MEETINGS (${meetingsCat})
- When in doubt: Marketing (${marketingCat}) beats FYI (${fyiCat}) if it has "Unsubscribe"
- Completed (${completedCat}) is ONLY for closed conversations, never random emails
- Company emails = Marketing (${marketingCat}), not FYI
- If you cannot determine a category, default to Notifications (${notificationsCat}) rather than leaving unlabeled

Email:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.slice(0, 2000)}

Respond with CATEGORY, CONFIDENCE, and REASONING:`;
}

/**
 * Parse the structured response from Claude
 */
function parseStructuredResponse(
  text: string,
  threadSignals: ThreadSignals,
  senderContext: SenderContext,
  categories: Record<string, CategoryConfig>
): ClassificationResult {
  const categoryMatch = text.match(/CATEGORY:\s*(\d+)/i);
  const confidenceMatch = text.match(/CONFIDENCE:\s*([\d.]+)/i);
  const reasoningMatch = text.match(/REASONING:\s*(.+?)(?:\n|$)/i);

  const category = categoryMatch ? parseInt(categoryMatch[1]) : 2;
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
  const reasoning = reasoningMatch
    ? reasoningMatch[1].trim()
    : "Unable to parse reasoning";

  const maxCategory = Math.max(
    ...Object.keys(categories).map((n) => parseInt(n))
  );

  // Validate category
  let finalCategory = category;
  if (category < 1 || category > maxCategory || !categories[category.toString()]) {
    finalCategory = 2;
  }

  // SAFETY OVERRIDE: If STRONG thread signal detected but classified as Spam (8), override
  // Only apply for genuine reply threads - require strong signals like subject prefix + headers
  // This prevents real marketing emails from being misclassified just because they have ">" chars
  const spamCategoryNum = Object.entries(categories).find(([, config]) => isSpamCategory(config.name))?.[0];
  const hasStrongThreadSignal = threadSignals.signals.includes("subject_prefix") && 
    (threadSignals.signals.includes("references_header") || threadSignals.signals.includes("in_reply_to_header"));
  
  if (hasStrongThreadSignal && spamCategoryNum && finalCategory === parseInt(spamCategoryNum)) {
    // Determine better category based on thread state
    const threadState = analyzeThreadState("", ""); // We don't have body here, use default
    let overrideCategory = 2; // Default to FYI

    if (senderContext.mostCommonCategory && senderContext.mostCommonCategory !== parseInt(spamCategoryNum)) {
      overrideCategory = senderContext.mostCommonCategory;
    }

    return {
      category: overrideCategory,
      confidence: 0.6,
      reasoning: `Reply thread incorrectly flagged as spam - overridden to category ${overrideCategory}`,
      isThread: true,
      senderKnown: senderContext.hasHistory,
    };
  }

  return {
    category: finalCategory,
    confidence: Math.min(Math.max(confidence, 0), 1),
    reasoning,
    isThread: threadSignals.isThread,
    senderKnown: senderContext.hasHistory,
  };
}

/**
 * Enhanced email classification with thread detection and sender context
 *
 * This is the new primary classification function that:
 * 1. Detects if the email is part of a thread (Tier 0)
 * 2. Looks up sender history for context
 * 3. Uses tiered classification prompt
 * 4. Returns confidence and reasoning for debugging
 */
export async function classifyEmailWithContext(
  email: {
    from: string;
    fromEmail: string;
    subject: string;
    body: string;
    references?: string;
    inReplyTo?: string;
  },
  senderContext: SenderContext,
  categories: Record<string, CategoryConfig> = DEFAULT_CATEGORIES
): Promise<ClassificationResult> {
  // TIER 0: Thread Detection (pre-check)
  const threadSignals = detectThreadSignals(
    email.subject,
    email.body,
    email.references,
    email.inReplyTo
  );

  // Build enhanced prompt with tiered analysis
  const prompt = buildTieredPrompt(
    {
      from: email.from,
      subject: email.subject,
      body: email.body,
    },
    senderContext,
    threadSignals,
    categories
  );

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200, // Increased to allow reasoning
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return {
        category: 2,
        confidence: 0.5,
        reasoning: "Parse error - non-text response",
        isThread: threadSignals.isThread,
        senderKnown: senderContext.hasHistory,
      };
    }

    return parseStructuredResponse(
      content.text,
      threadSignals,
      senderContext,
      categories
    );
  } catch (apiError) {
    // FALLBACK: If API call fails entirely, return a safe default
    console.error("Claude API call failed in classifyEmailWithContext:", apiError);
    const fallbackCategory = categories["2"] ? 2 : parseInt(Object.keys(categories)[0] || "1");
    return {
      category: fallbackCategory,
      confidence: 0.1,
      reasoning: `API error - fallback to category ${fallbackCategory}`,
      isThread: threadSignals.isThread,
      senderKnown: senderContext.hasHistory,
    };
  }
}

/**
 * Unified classification function with fallback support
 *
 * Uses enhanced classification by default, falls back to simple
 * classification if enhanced data is missing.
 */
export async function classifyEmail(
  email: {
    from: string;
    fromEmail?: string;
    subject: string;
    body: string;
    references?: string;
    inReplyTo?: string;
  },
  senderContext?: SenderContext,
  categories: Record<string, CategoryConfig> = DEFAULT_CATEGORIES
): Promise<ClassificationResult> {
  // Check if we can use enhanced classification
  const useEnhanced =
    process.env.ENHANCED_CLASSIFICATION !== "false" &&
    email.fromEmail &&
    senderContext;

  if (!useEnhanced) {
    // Fallback to simple classification
    const simpleCategory = await classifyEmailCategory(
      email.from,
      email.subject,
      email.body,
      categories
    );

    // Still detect thread signals for the result
    const threadSignals = detectThreadSignals(
      email.subject,
      email.body,
      email.references,
      email.inReplyTo
    );

    return {
      category: simpleCategory,
      confidence: 0.7,
      reasoning: "Simple classification (enhanced disabled or data missing)",
      isThread: threadSignals.isThread,
      senderKnown: false,
    };
  }

  return classifyEmailWithContext(
    {
      from: email.from,
      fromEmail: email.fromEmail!,
      subject: email.subject,
      body: email.body,
      references: email.references,
      inReplyTo: email.inReplyTo,
    },
    senderContext!,
    categories
  );
}
