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
  return displayName === "respond" || displayName === "to respond" || displayName === "reply needed";
}

export const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": {
    name: "1: Respond",
    color: "#F87171",
    enabled: true,
    required: true,
    description: "Requires your reply or action",
    rules: "",
    drafts: true,
    order: 1,
  },
  "2": {
    name: "2: Update",
    color: "#FB923C",
    enabled: true,
    description: "Worth knowing, no response required",
    rules: "",
    drafts: false,
    order: 2,
  },
  "3": {
    name: "3: Comment",
    color: "#22D3EE",
    enabled: true,
    description: "Mentions from docs, threads & chats",
    rules: "",
    drafts: false,
    order: 3,
  },
  "4": {
    name: "4: Notification",
    color: "#4ADE80",
    enabled: true,
    description: "Automated alerts & confirmations",
    rules: "",
    drafts: false,
    order: 4,
  },
  "5": {
    name: "5: Calendar",
    color: "#A855F7",
    enabled: true,
    description: "Meetings, invites & calendar events",
    rules: "",
    drafts: false,
    order: 5,
  },
  "6": {
    name: "6: Pending",
    color: "#60A5FA",
    enabled: true,
    description: "Waiting on someone else's response",
    rules: "",
    drafts: false,
    order: 6,
  },
  "7": {
    name: "7: Complete",
    color: "#2DD4BF",
    enabled: true,
    description: "Resolved or finished conversations",
    rules: "",
    drafts: false,
    order: 7,
  },
  "8": {
    name: "8: Marketing/Spam",
    color: "#F472B6",
    enabled: true,
    description: "Newsletters, sales & promotional",
    rules: "",
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

IMPORTANT:
- Be strict about "Respond" - only genuine personal emails needing a reply
- Marketing emails often look personal (using names, company references) - check sender domain
- Cold sales outreach is Marketing/Spam, never Respond
- Automated notifications are never Respond
- If unsure, prefer a less important category over Respond
${hasOther ? '- Use "Other" if email doesn\'t clearly fit any category' : ''}

Email:
From: ${from}
Subject: ${subject}
Body: ${body.slice(0, 2000)}

Category number (1-${maxCategory}):`;

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
    lengthInstruction: "Keep your response SHORT and DIRECT - aim for 2-4 sentences maximum. Get straight to the point without filler or unnecessary pleasantries.",
    maxTokens: 300,
  },
  balanced: {
    temperature: 0.5,
    lengthInstruction: "Write a natural-length response appropriate to the context. Be helpful but don't over-explain.",
    maxTokens: 600,
  },
  detailed: {
    temperature: 0.7,
    lengthInstruction: "Provide a thorough, comprehensive response that fully addresses all aspects of the email.",
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
  threadContext: string = ""  // Full conversation history for context
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

  const prompt = `Write a professional email reply to this message.
${threadSection}
From: ${from}
Subject: ${subject}
Body:
${body.slice(0, 3000)}

Instructions:
- ${config.lengthInstruction}
- Write a helpful, professional response
- Match the tone of the original email${styleInstruction}${threadInstruction}
- Only write the email body text
- Do NOT include a subject line
- Do NOT include a greeting like "Dear..." (start with the content)
- Do NOT include a sign-off or signature (that will be added separately)
- Do NOT make up information you don't know - if you need info from the user, indicate that clearly

Write ONLY the email body text:`;

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

ANALYSIS TIERS (check in order, stop at first match):

TIER 0 - THREAD CONTEXT (highest priority):
Is this part of an existing conversation thread?
- If YES and it's a reply thread: NEVER classify as Marketing/Spam
- Analyze based on conversation state (question asked, answer given, etc.)

TIER 1 - STRUCTURAL SIGNALS:
- Calendar invite attachment or meeting request → Calendar
- @mention or direct question to you → Respond
- Automated system notification (receipts, alerts) → Notification

TIER 2 - CONVERSATION STATE:
- Waiting on someone else → Pending
- Matter is resolved/complete → Complete
- Just a "thanks" or acknowledgment → Complete

TIER 3 - CONTENT ANALYSIS:
- Requires your reply/action → Respond
- FYI/informational → Update
- Thread mention/discussion → Comment

TIER 4 - CATCH-ALL:
- Marketing/Spam ONLY if ALL of these are true:
  1. NOT a reply thread (no Re:/Fwd: prefix, no quoted content)
  2. First contact OR bulk sender
  3. Has 2+ marketing signals: unsubscribe link, promotional language, mass-send format
${hasOther ? '- Use "Other" if email doesn\'t clearly fit any category' : ""}

Categories:
${categoryList}
${contextSection}

UNCERTAINTY HANDLING:
If confidence < 70% between two categories, prefer:
- Marketing vs Update → Known contact = Update, Unknown = Marketing
- Respond vs Update → If any question exists = Respond
- Notification vs Calendar → If specific date/time to attend = Calendar
- Pending vs Complete → If open loop remains = Pending

Default hierarchy when truly uncertain:
Respond > Calendar > Pending > Comment > Update > Notification > Complete > Marketing/Spam > Other
(Better to surface something that might need action than bury it in Marketing/Spam)

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

  // SAFETY OVERRIDE: If thread detected but classified as Marketing/Spam (8), override
  // This is the critical protection against misclassifying reply threads
  if (threadSignals.isThread && finalCategory === 8) {
    // Determine better category based on thread state
    const threadState = analyzeThreadState("", ""); // We don't have body here, use default
    let overrideCategory = 2; // Default to Update

    if (senderContext.mostCommonCategory && senderContext.mostCommonCategory !== 8) {
      overrideCategory = senderContext.mostCommonCategory;
    }

    return {
      category: overrideCategory,
      confidence: 0.6,
      reasoning: `Reply thread incorrectly flagged as marketing - overridden to category ${overrideCategory}`,
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
