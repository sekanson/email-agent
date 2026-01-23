import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  const displayName = getDisplayName(name);
  return displayName === "Respond";
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

export async function generateDraftResponse(
  from: string,
  subject: string,
  body: string,
  temperature: number = 0.7,
  signature: string = "",
  writingStyle: string = ""
): Promise<string> {
  const styleInstruction = writingStyle
    ? `\n- IMPORTANT: Match this writing style: ${writingStyle}`
    : "";

  const prompt = `Write a professional email reply to this message.

From: ${from}
Subject: ${subject}
Body:
${body.slice(0, 3000)}

Instructions:
- Write a helpful, professional response
- Be concise but thorough
- Match the tone of the original email${styleInstruction}
- Only write the email body text
- Do NOT include a subject line
- Do NOT include a greeting like "Dear..." (start with the content)
- Do NOT include a sign-off or signature (that will be added separately)

Write ONLY the email body text:`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    temperature,
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
