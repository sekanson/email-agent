import Anthropic from "@anthropic-ai/sdk";
import { detectThreadSignals, ThreadSignals, analyzeThreadState } from "./thread-detection";
import { SenderContext, formatSenderContextForPrompt } from "./sender-context";

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

export const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": {
    name: "1: Reply Needed 🔴",
    color: "#EF4444",
    enabled: true,
    required: true,
    description: "Requires YOUR direct response",
    rules: "Direct questions to you, requests for YOUR input, approval requests, personal emails asking something specific",
    drafts: true,
    order: 1,
  },
  "2": {
    name: "2: FYI 🟠",
    color: "#F97316",
    enabled: true,
    description: "Worth reading, no action needed",
    rules: "Status updates, announcements, shared docs for awareness, informational forwards, thank-you messages",
    drafts: false,
    order: 2,
  },
  "3": {
    name: "3: Calendar 🟣",
    color: "#A855F7",
    enabled: true,
    description: "Time-bound, scheduling related",
    rules: "Meeting invites, event notifications, RSVPs, scheduling requests, appointment reminders, calendar attachments",
    drafts: false,
    order: 3,
  },
  "4": {
    name: "4: Receipts 🟢",
    color: "#22C55E",
    enabled: true,
    description: "Transactional paper trail",
    rules: "Payment confirmations, invoices, shipping notifications, order confirmations, account statements, subscription receipts, purchase receipts",
    drafts: false,
    order: 4,
  },
  "5": {
    name: "5: Mentions 🔵",
    color: "#3B82F6",
    enabled: true,
    description: "CC'd or tagged, not direct ask",
    rules: "CC'd on threads, @mentions, document comments, group discussions where you're not the primary recipient",
    drafts: false,
    order: 5,
  },
  "6": {
    name: "6: Waiting ⏳",
    color: "#EAB308",
    enabled: true,
    description: "Ball in someone else's court",
    rules: "Emails where you've asked something and await response, submitted applications, pending approvals from others, confirmations you're waiting for",
    drafts: false,
    order: 6,
  },
  "7": {
    name: "7: Newsletters 📰",
    color: "#06B6D4",
    enabled: true,
    description: "Subscribed/wanted content",
    rules: "Regular digests, mailing lists you subscribed to, educational content, product updates from services you actively use",
    drafts: false,
    order: 7,
  },
  "8": {
    name: "8: Spam 🗑️",
    color: "#6B7280",
    enabled: true,
    description: "Unwanted/unsolicited",
    rules: "Cold sales outreach, unsolicited marketing, promotional emails you didn't subscribe to, actual spam, first-contact selling",
    drafts: false,
    order: 8,
  },
};

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

  const prompt = `Classify this email into exactly ONE category. Respond with ONLY the category number.

Categories:
${categoryList}

=== CRITICAL CLASSIFICATION RULES (follow strictly) ===

1. COLD OUTREACH = ALWAYS SPAM (category 8)
   - First contact + selling/pitching something = Spam
   - Unknown sender + promotional content = Spam
   - "Reaching out because..." + product pitch = Spam

2. RECEIPTS ARE SACRED (category 4)
   - Payment confirmation = ALWAYS Receipts (never FYI)
   - Invoice/billing = ALWAYS Receipts
   - Order/shipping confirmation = ALWAYS Receipts
   - Account statement = ALWAYS Receipts

3. CALENDAR HAS PRIORITY (category 3)
   - Meeting invite with date/time = ALWAYS Calendar
   - Event notification = ALWAYS Calendar
   - RSVP request = ALWAYS Calendar

4. NEWSLETTERS vs SPAM
   - Has "Unsubscribe" + broadcast format + no personal ask:
     * From a service you likely USE = Newsletters (7)
     * From unknown/unsolicited source = Spam (8)
   - Product updates from services you use = Newsletters
   - Cold marketing from unknown sender = Spam

5. REPLY NEEDED = Direct ask to YOU (category 1)
   - Direct question requiring YOUR answer = Reply Needed
   - Request for YOUR input/approval = Reply Needed
   - Personal email asking something specific = Reply Needed
   - NOT: automated notifications, bulk emails, FYI forwards

6. CC'd vs PRIMARY (category 5)
   - You're in CC but not TO = Mentions
   - @mentioned in a doc/thread = Mentions
   - Group thread where you're not primary = Mentions

7. FYI = Worth reading, no action (category 2)
   - Status updates = FYI
   - "Just letting you know" = FYI
   - "Thanks!" or acknowledgment = FYI
   - Informational forwards = FYI

8. WAITING = Ball in their court (category 6)
   - You asked a question, they haven't answered = Waiting
   - Submitted application = Waiting
   - Pending approval from others = Waiting

${hasOther ? '- Use "Other" (99) if email doesn\'t clearly fit any category' : ''}

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
    lengthInstruction: "Keep your response to 2-4 sentences MAXIMUM. Be direct and to the point. No filler, no unnecessary pleasantries.",
    maxTokens: 200,
  },
  balanced: {
    temperature: 0.5,
    lengthInstruction: "Write a response of 4-6 sentences. Cover the key points naturally without over-explaining.",
    maxTokens: 400,
  },
  detailed: {
    temperature: 0.7,
    lengthInstruction: "Provide a thorough response of 6+ sentences as needed. Fully address all aspects of the email with appropriate detail.",
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
- Only write the email body text
- Do NOT include a subject line
- Do NOT include a greeting like "Dear..." (start with the content)
- Do NOT include a sign-off or signature (that will be added separately)
- If you need information from the user to complete the response, add a placeholder like [PLEASE ADD: specific info needed]

Write ONLY the email body text (remember: you're the USER replying TO ${senderName}):`;

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

=== CRITICAL CLASSIFICATION RULES (non-negotiable) ===

★ COLD OUTREACH = ALWAYS SPAM (8)
  - First contact + selling/pitching = Spam
  - Unknown sender + promotional = Spam

★ RECEIPTS ARE SACRED (4) - Never misclassify as FYI!
  - Payment/invoice/order confirmation = ALWAYS Receipts
  - Shipping notification = ALWAYS Receipts
  - Account statement = ALWAYS Receipts

★ CALENDAR HAS PRIORITY (3)
  - Meeting invite with date/time = ALWAYS Calendar
  - Event notification/RSVP = ALWAYS Calendar

★ NEWSLETTERS vs SPAM (7 vs 8)
  - "Unsubscribe" + broadcast + service you USE = Newsletters (7)
  - "Unsubscribe" + broadcast + unknown source = Spam (8)

★ REPLY NEEDED = Direct ask to YOU (1)
  - Direct question for YOUR answer = Reply Needed
  - Request for YOUR approval/input = Reply Needed

★ CC'd = MENTIONS (5)
  - In CC but not TO = Mentions
  - @mentioned but not primary = Mentions

=== ANALYSIS TIERS (check in order) ===

TIER 0 - THREAD CONTEXT (highest priority):
Is this part of an existing conversation thread?
- If YES and it's a reply thread: NEVER classify as Spam
- Analyze based on conversation state

TIER 1 - STRUCTURAL SIGNALS:
- Receipt/invoice/payment keywords → Receipts (4)
- Calendar invite attachment or meeting request → Calendar (3)
- @mention or direct question to you → Reply Needed (1)
- CC'd not primary recipient → Mentions (5)

TIER 2 - CONVERSATION STATE:
- Waiting on someone else → Waiting (6)
- Just a "thanks" or acknowledgment → FYI (2)

TIER 3 - CONTENT ANALYSIS:
- Requires your reply/action → Reply Needed (1)
- FYI/informational/status update → FYI (2)

TIER 4 - SUBSCRIPTION CONTENT:
- Regular digest/newsletter from known service → Newsletters (7)
- Product updates from service you use → Newsletters (7)

TIER 5 - CATCH-ALL:
- Spam ONLY if ALL of these are true:
  1. NOT a reply thread
  2. First contact OR bulk sender
  3. Has promotional content from unknown/unwanted source
${hasOther ? '- Use "Other" (99) if email doesn\'t clearly fit any category' : ""}

Categories:
${categoryList}
${contextSection}

UNCERTAINTY HANDLING:
If confidence < 70% between two categories, prefer:
- Spam vs Newsletters → Known service = Newsletters, Unknown = Spam
- Spam vs FYI → Known contact = FYI, Unknown = Spam
- Reply Needed vs FYI → If any direct question = Reply Needed
- Receipts vs FYI → If transaction/payment = ALWAYS Receipts
- Calendar vs FYI → If date/time to attend = ALWAYS Calendar
- Waiting vs FYI → If open loop remains = Waiting

Default hierarchy when truly uncertain:
Reply Needed (1) > Calendar (3) > Receipts (4) > Waiting (6) > Mentions (5) > FYI (2) > Newsletters (7) > Spam (8) > Other (99)
(Better to surface something that might need action than bury it)

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

  // SAFETY OVERRIDE: If thread detected but classified as Spam (8), override
  // This is the critical protection against misclassifying reply threads
  // Note: Spam (8) should NEVER be assigned to reply threads
  const spamCategoryNum = Object.entries(categories).find(([, config]) => isSpamCategory(config.name))?.[0];
  if (threadSignals.isThread && spamCategoryNum && finalCategory === parseInt(spamCategoryNum)) {
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
