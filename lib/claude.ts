import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
  required?: boolean; // true for "To Respond" and "Other"
  rules?: string; // Classification hints for the AI
}

export const DEFAULT_RULES: Record<string, string> = {
  "To Respond": "Direct questions or personal requests that genuinely need my reply. Exclude newsletters, marketing, cold outreach, and automated emails even if they contain questions or personalization.",
  "FYI": "Informational emails I should be aware of but don't require a response or action.",
  "Comment": "Notifications about comments on documents, tasks, code reviews, or threads I'm involved in.",
  "Notification": "Automated system notifications, alerts, status updates, and confirmations from apps and services.",
  "Meeting Update": "Calendar invites, meeting changes, scheduling requests, RSVPs, and video call links.",
  "Awaiting Reply": "Email threads where I've already responded and am waiting for the other person.",
  "Actioned": "Emails I've already handled, completed tasks, or resolved issues.",
  "Marketing": "Promotional content, newsletters, sales outreach, cold emails, and mass campaigns. Includes emails using personalization tricks to appear personal but are automated.",
  "Other": "Emails that don't clearly fit any other category.",
};

export const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": { name: "To Respond", color: "#ef4444", enabled: true, required: true, rules: DEFAULT_RULES["To Respond"] },
  "2": { name: "FYI", color: "#f59e0b", enabled: true, rules: DEFAULT_RULES["FYI"] },
  "3": { name: "Comment", color: "#10b981", enabled: true, rules: DEFAULT_RULES["Comment"] },
  "4": { name: "Notification", color: "#6366f1", enabled: true, rules: DEFAULT_RULES["Notification"] },
  "5": { name: "Meeting Update", color: "#8b5cf6", enabled: true, rules: DEFAULT_RULES["Meeting Update"] },
  "6": { name: "Awaiting Reply", color: "#06b6d4", enabled: true, rules: DEFAULT_RULES["Awaiting Reply"] },
  "7": { name: "Actioned", color: "#84cc16", enabled: true, rules: DEFAULT_RULES["Actioned"] },
  "8": { name: "Marketing", color: "#f97316", enabled: true, rules: DEFAULT_RULES["Marketing"] },
};

export const OTHER_CATEGORY: CategoryConfig = {
  name: "Other",
  color: "#6b7280",
  enabled: true,
  required: true,
  rules: DEFAULT_RULES["Other"],
};

export async function classifyEmailCategory(
  from: string,
  subject: string,
  body: string,
  categories: Record<string, CategoryConfig> = DEFAULT_CATEGORIES
): Promise<number> {
  // Build dynamic category list from user settings with rules
  const sortedCategories = Object.entries(categories)
    .filter(([, config]) => config.enabled)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  // Build category list with rules
  const categoryList = sortedCategories
    .map(([num, config]) => {
      if (config.rules) {
        return `${num}. ${config.name}: ${config.rules}`;
      }
      return `${num}. ${config.name}`;
    })
    .join("\n");

  const maxCategory = Math.max(
    ...Object.keys(categories).map((n) => parseInt(n))
  );

  // Check if "Other" category exists
  const hasOther = sortedCategories.some(([, config]) => config.name === "Other");

  const prompt = `Classify this email into exactly ONE category. Respond with ONLY the category number.

Categories:
${categoryList}

IMPORTANT:
- Be strict about "To Respond" - only genuine personal emails needing a reply
- Marketing emails often look personal (using names, company references) - check sender domain
- Cold sales outreach is Marketing, never To Respond
- Automated notifications are never To Respond
- If unsure, prefer a less important category over To Respond
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

  // Default to category 2 (usually FYI/Other) if parsing fails
  return Object.keys(categories).length >= 2 ? 2 : 1;
}

export async function generateDraftResponse(
  from: string,
  subject: string,
  body: string,
  temperature: number = 0.7,
  signature: string = ""
): Promise<string> {
  const prompt = `Write a professional email reply to this message.

From: ${from}
Subject: ${subject}
Body:
${body.slice(0, 3000)}

Instructions:
- Write a helpful, professional response
- Be concise but thorough
- Match the tone of the original email
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
