import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
  required?: boolean; // true for "To Respond" and "Other"
}

export const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": { name: "To Respond", color: "#ef4444", enabled: true, required: true },
  "2": { name: "FYI", color: "#f59e0b", enabled: true },
  "3": { name: "Comment", color: "#10b981", enabled: true },
  "4": { name: "Notification", color: "#6366f1", enabled: true },
  "5": { name: "Meeting Update", color: "#8b5cf6", enabled: true },
  "6": { name: "Awaiting Reply", color: "#06b6d4", enabled: true },
  "7": { name: "Actioned", color: "#84cc16", enabled: true },
  "8": { name: "Marketing", color: "#f97316", enabled: true },
};

export const OTHER_CATEGORY: CategoryConfig = {
  name: "Other",
  color: "#6b7280",
  enabled: true,
  required: true,
};

export async function classifyEmailCategory(
  from: string,
  subject: string,
  body: string,
  categories: Record<string, CategoryConfig> = DEFAULT_CATEGORIES
): Promise<number> {
  // Build dynamic category list from user settings
  const sortedCategories = Object.entries(categories)
    .filter(([, config]) => config.enabled)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  const categoryList = sortedCategories
    .map(([num, config]) => `${num} = ${config.name}`)
    .join("\n");

  const maxCategory = Math.max(
    ...Object.keys(categories).map((n) => parseInt(n))
  );

  // Check if "Other" category exists
  const hasOther = sortedCategories.some(([, config]) => config.name === "Other");

  let otherInstruction = "";
  if (hasOther) {
    otherInstruction = `\n\nIf the email doesn't clearly fit any specific category above, classify it as "Other". This includes marketing emails, notifications, and other types that may have been consolidated.`;
  }

  const prompt = `Classify this email into one of the following categories. Respond with ONLY a single number:

${categoryList}

Email:
From: ${from}
Subject: ${subject}
Body: ${body.slice(0, 2000)}

Important: Category 1 is typically for emails that require YOUR direct response/action.${otherInstruction}

Respond with ONLY the number (1-${maxCategory}), nothing else.`;

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
