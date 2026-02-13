import { google } from "googleapis";

export interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;  // Extracted email address from "Name <email>" format
  to: string;
  cc?: string;        // CC recipients
  date: string;
  bodyPreview: string;
  body: string;
  // Thread detection headers
  references?: string;   // References header for thread tracking
  inReplyTo?: string;    // In-Reply-To header
  messageId?: string;    // Message-ID header
}

export interface ThreadMessage {
  from: string;
  fromEmail: string;
  to: string;
  cc?: string;
  date: string;
  body: string;
  isFromUser: boolean;  // true if this message was sent by the user
}

// Extract email address from "Name <email@domain.com>" format
function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : fromHeader.trim().toLowerCase();
}

export interface GmailLabel {
  id: string;
  name: string;
}

function getOAuth2Client(accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token!;
}

export async function getEmails(
  accessToken: string,
  refreshToken: string,
  maxResults: number = 10,
  query: string = "is:unread"
): Promise<Email[]> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: query,
  });

  const messages = response.data.messages || [];
  const emails: Email[] = [];

  for (const message of messages) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: message.id!,
      format: "full",
    });

    const headers = msg.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
      "";

    let body = "";
    const payload = msg.data.payload;

    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload?.parts) {
      const textPart = payload.parts.find(
        (p) => p.mimeType === "text/plain"
      );
      const htmlPart = payload.parts.find(
        (p) => p.mimeType === "text/html"
      );
      const part = textPart || htmlPart;
      if (part?.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }

    const fromHeader = getHeader("from");
    const ccHeader = getHeader("cc");
    emails.push({
      id: message.id!,
      threadId: message.threadId!,
      subject: getHeader("subject"),
      from: fromHeader,
      fromEmail: extractEmailAddress(fromHeader),
      to: getHeader("to"),
      cc: ccHeader || undefined,
      date: getHeader("date"),
      bodyPreview: msg.data.snippet || "",
      body,
      // Thread detection headers
      references: getHeader("references") || undefined,
      inReplyTo: getHeader("in-reply-to") || undefined,
      messageId: getHeader("message-id") || undefined,
    });
  }

  return emails;
}

/**
 * Fetch all messages in a thread to get full conversation context
 * Returns messages in chronological order (oldest first)
 */
export async function getThreadMessages(
  accessToken: string,
  refreshToken: string,
  threadId: string,
  userEmail: string
): Promise<ThreadMessage[]> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages = response.data.messages || [];
  const threadMessages: ThreadMessage[] = [];

  for (const msg of messages) {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    let body = "";
    const payload = msg.payload;

    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload?.parts) {
      const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
      const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
      const part = textPart || htmlPart;
      if (part?.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }

    const fromHeader = getHeader("from");
    const fromEmail = extractEmailAddress(fromHeader);

    // Check if this message was sent by the user
    const isFromUser = fromEmail.toLowerCase() === userEmail.toLowerCase();

    threadMessages.push({
      from: fromHeader,
      fromEmail,
      to: getHeader("to"),
      cc: getHeader("cc") || undefined,
      date: getHeader("date"),
      body: body.slice(0, 2000), // Limit each message body
      isFromUser,
    });
  }

  // Sort by date (oldest first) for chronological context
  threadMessages.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  return threadMessages;
}

/**
 * Format thread messages for AI context
 */
export function formatThreadForAI(messages: ThreadMessage[], maxLength: number = 4000): string {
  if (messages.length <= 1) {
    return ""; // No thread context needed for single message
  }

  let formatted = "=== PREVIOUS CONVERSATION ===\n\n";
  let totalLength = formatted.length;

  // Include messages from oldest to newest, but skip the last one (current email)
  const previousMessages = messages.slice(0, -1);

  for (const msg of previousMessages) {
    const sender = msg.isFromUser ? "YOU (sent)" : msg.from;
    const entry = `[${msg.date}] ${sender}:\n${msg.body}\n\n---\n\n`;

    if (totalLength + entry.length > maxLength) {
      formatted += "[Earlier messages truncated for length]\n\n";
      break;
    }

    formatted += entry;
    totalLength += entry.length;
  }

  formatted += "=== END PREVIOUS CONVERSATION ===\n\n";
  return formatted;
}

// Gmail's allowed label color palette (verified from API)
// These are the ONLY colors Gmail accepts for labels
export const GMAIL_ALLOWED_COLORS = [
  { bg: "#fb4c2f", text: "#ffffff", name: "Red" },
  { bg: "#cc3a21", text: "#ffffff", name: "Dark Red" },
  { bg: "#ffad47", text: "#ffffff", name: "Orange" },
  { bg: "#fad165", text: "#000000", name: "Yellow" },
  { bg: "#16a766", text: "#ffffff", name: "Green" },
  { bg: "#43d692", text: "#000000", name: "Light Green" },
  { bg: "#4a86e8", text: "#ffffff", name: "Blue" },
  { bg: "#a479e2", text: "#ffffff", name: "Purple" },
  { bg: "#f691b3", text: "#000000", name: "Pink" },
  { bg: "#2da2bb", text: "#ffffff", name: "Cyan" },
  { bg: "#b99aff", text: "#000000", name: "Light Purple" },
  { bg: "#ff7537", text: "#ffffff", name: "Orange Red" },
];

// Convert hex to RGB for color distance calculation
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Calculate color distance (simple Euclidean in RGB space)
function colorDistance(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

// Find the closest Gmail color to any arbitrary hex color
function findClosestGmailColor(hexColor: string): { backgroundColor: string; textColor: string } {
  const inputRgb = hexToRgb(hexColor);
  let closestIndex = 0;
  let minDistance = Infinity;

  GMAIL_ALLOWED_COLORS.forEach((gmailColor, index) => {
    const gmailRgb = hexToRgb(gmailColor.bg);
    const distance = colorDistance(inputRgb, gmailRgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });

  const color = GMAIL_ALLOWED_COLORS[closestIndex];
  return { backgroundColor: color.bg, textColor: color.text };
}

function getGmailColor(hexColor: string): { backgroundColor: string; textColor: string } {
  // Use closest color matching for any input color
  return findClosestGmailColor(hexColor);
}

export async function createLabel(
  accessToken: string,
  refreshToken: string,
  labelName: string,
  color?: string
): Promise<GmailLabel> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const labelColor = color ? getGmailColor(color) : undefined;

  const response = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
      color: labelColor,
    },
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
  };
}

export async function updateLabelColor(
  accessToken: string,
  refreshToken: string,
  labelId: string,
  color: string
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const labelColor = getGmailColor(color);

  await gmail.users.labels.update({
    userId: "me",
    id: labelId,
    requestBody: {
      color: labelColor,
    },
  });
}

export async function updateLabel(
  accessToken: string,
  refreshToken: string,
  labelId: string,
  newName: string,
  color?: string
): Promise<GmailLabel> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const requestBody: { name: string; color?: { backgroundColor: string; textColor: string } } = {
    name: newName,
  };

  if (color) {
    requestBody.color = getGmailColor(color);
  }

  const response = await gmail.users.labels.update({
    userId: "me",
    id: labelId,
    requestBody,
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
  };
}

export async function deleteLabel(
  accessToken: string,
  refreshToken: string,
  labelId: string
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  await gmail.users.labels.delete({
    userId: "me",
    id: labelId,
  });
}

export async function getLabels(
  accessToken: string,
  refreshToken: string
): Promise<GmailLabel[]> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.labels.list({
    userId: "me",
  });

  return (response.data.labels || []).map((label) => ({
    id: label.id!,
    name: label.name!,
  }));
}

export async function applyLabel(
  accessToken: string,
  refreshToken: string,
  messageId: string,
  labelId: string
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: [labelId],
    },
  });
}

/**
 * Replace category label - removes all existing category labels and applies the new one.
 * This ensures only ONE category label is ever on an email, and it gets updated
 * as the conversation evolves.
 * @deprecated Use replaceCategoryLabelOnThread for thread-level labeling
 */
export async function replaceCategoryLabel(
  accessToken: string,
  refreshToken: string,
  messageId: string,
  newLabelId: string,
  allCategoryLabelIds: string[]
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  // Get current labels on the message
  const message = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "minimal",
  });

  const currentLabelIds = message.data.labelIds || [];

  // Find which category labels are currently on this message
  const labelsToRemove = currentLabelIds.filter(
    (id) => allCategoryLabelIds.includes(id) && id !== newLabelId
  );

  // Build the modification request
  const requestBody: { addLabelIds?: string[]; removeLabelIds?: string[] } = {};

  if (labelsToRemove.length > 0) {
    requestBody.removeLabelIds = labelsToRemove;
  }

  // Only add if not already present
  if (!currentLabelIds.includes(newLabelId)) {
    requestBody.addLabelIds = [newLabelId];
  }

  // Only make the API call if there's something to change
  if (requestBody.addLabelIds || requestBody.removeLabelIds) {
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody,
    });
  }
}

/**
 * Replace category label on ENTIRE THREAD - removes all existing category labels 
 * from ALL messages in the thread and applies the new one to ALL messages.
 * This ensures the thread has ONE consistent category label that updates
 * based on the latest email in the conversation.
 */
export async function replaceCategoryLabelOnThread(
  accessToken: string,
  refreshToken: string,
  threadId: string,
  newLabelId: string,
  allCategoryLabelIds: string[]
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  // Get all messages in the thread
  const thread = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "minimal",
  });

  const messages = thread.data.messages || [];
  
  // Process each message in the thread
  for (const message of messages) {
    const messageId = message.id!;
    const currentLabelIds = message.labelIds || [];

    // Find which category labels are currently on this message
    const labelsToRemove = currentLabelIds.filter(
      (id) => allCategoryLabelIds.includes(id) && id !== newLabelId
    );

    // Build the modification request
    const requestBody: { addLabelIds?: string[]; removeLabelIds?: string[] } = {};

    if (labelsToRemove.length > 0) {
      requestBody.removeLabelIds = labelsToRemove;
    }

    // Only add if not already present
    if (!currentLabelIds.includes(newLabelId)) {
      requestBody.addLabelIds = [newLabelId];
    }

    // Only make the API call if there's something to change
    if (requestBody.addLabelIds || requestBody.removeLabelIds) {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody,
      });
    }
  }
}

export async function removeLabel(
  accessToken: string,
  refreshToken: string,
  messageId: string,
  labelId: string
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: [labelId],
    },
  });
}

export async function createDraft(
  accessToken: string,
  refreshToken: string,
  to: string,
  subject: string,
  body: string,
  threadId: string,
  cc?: string,  // Optional CC for reply-all
  userEmail?: string  // User's email to exclude from CC
): Promise<string> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  // Check if body contains HTML (signature or formatting)
  const isHtml = /<[^>]+>/.test(body);

  let formattedBody: string;
  let contentType: string;

  if (isHtml) {
    // Body contains HTML (e.g. signature). Convert the plain-text draft portion
    // into Gmail-native <div> elements so the compose editor handles it cleanly.
    // Gmail internally represents each line as a <div>, so we match that structure.
    const htmlTagIndex = body.search(/<[a-z]/i);
    const plainPart = htmlTagIndex > 0 ? body.slice(0, htmlTagIndex) : "";
    const htmlPart = htmlTagIndex > 0 ? body.slice(htmlTagIndex) : body;

    // Convert each line to a <div> (Gmail's native format)
    // Empty lines become <div><br></div> (Gmail's blank line)
    const htmlLines = plainPart
      .split('\n')
      .map(line => line.trim() === '' ? '<div><br></div>' : `<div>${line}</div>`)
      .join('\n');

    formattedBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
${htmlLines}
<div><br></div>
${htmlPart}
</body>
</html>`;
    contentType = "text/html; charset=utf-8";
  } else {
    formattedBody = body;
    contentType = "text/plain; charset=utf-8";
  }

  // Build message headers
  const headers = [
    `To: ${to}`,
  ];

  // Add CC if provided (for reply-all), excluding the user's own email
  if (cc) {
    // Parse CC addresses and filter out user's own email
    const ccAddresses = cc.split(',')
      .map(addr => addr.trim())
      .filter(addr => {
        if (!userEmail) return true;
        const email = extractEmailAddress(addr).toLowerCase();
        return email !== userEmail.toLowerCase();
      });

    if (ccAddresses.length > 0) {
      headers.push(`Cc: ${ccAddresses.join(', ')}`);
    }
  }

  headers.push(
    `Subject: Re: ${subject.replace(/^Re:\s*/i, "")}`,
    `Content-Type: ${contentType}`,
    "",
    formattedBody
  );

  const message = headers.join("\r\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: encodedMessage,
        threadId,
      },
    },
  });

  return response.data.id!;
}

export async function sendEmail(
  accessToken: string,
  refreshToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string
) {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  // Auto-detect HTML content
  const isHtml = /<[^>]+>/.test(body);
  const contentType = isHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: ${contentType}`,
    "",
    body,
  ].join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      threadId,
    },
  });

  return response.data;
}

/**
 * Get all participants (To, CC, From) from a thread for reply-all functionality
 * Returns unique emails excluding the user's own email
 */
export async function getThreadParticipants(
  accessToken: string,
  refreshToken: string,
  threadId: string,
  userEmail: string
): Promise<{ to: string[]; cc: string[] }> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["From", "To", "Cc"],
  });

  const messages = response.data.messages || [];
  const allParticipants = new Set<string>();
  const userEmailLower = userEmail.toLowerCase();

  for (const msg of messages) {
    const headers = msg.payload?.headers || [];
    
    for (const header of headers) {
      if (["from", "to", "cc"].includes(header.name?.toLowerCase() || "")) {
        const value = header.value || "";
        // Parse multiple addresses (comma-separated)
        const addresses = value.split(",").map(addr => {
          const email = extractEmailAddress(addr.trim());
          return email.toLowerCase();
        }).filter(email => email && email !== userEmailLower);
        
        addresses.forEach(addr => allParticipants.add(addr));
      }
    }
  }

  // Get the most recent message to determine primary recipient
  const lastMsg = messages[messages.length - 1];
  const lastHeaders = lastMsg?.payload?.headers || [];
  const lastFrom = extractEmailAddress(
    lastHeaders.find(h => h.name?.toLowerCase() === "from")?.value || ""
  ).toLowerCase();

  // Primary "To" is whoever sent the last message (we're replying to them)
  // Everyone else goes to CC
  const to = lastFrom && lastFrom !== userEmailLower ? [lastFrom] : [];
  const cc = Array.from(allParticipants).filter(addr => !to.includes(addr));

  return { to, cc };
}

export async function markAsRead(
  accessToken: string,
  refreshToken: string,
  messageId: string
) {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}

// ============ Filter Management (for Focus Mode) ============

export async function getFilters(
  accessToken: string,
  refreshToken: string
): Promise<any[]> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.settings.filters.list({
    userId: "me",
  });

  return response.data.filter || [];
}

export async function createFilter(
  accessToken: string,
  refreshToken: string,
  filterConfig: {
    criteria: {
      from?: string;
      to?: string;
      subject?: string;
      query?: string;
      hasAttachment?: boolean;
    };
    action: {
      addLabelIds?: string[];
      removeLabelIds?: string[];
      forward?: string;
    };
  }
): Promise<any> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: filterConfig,
  });

  return response.data;
}

export async function deleteFilter(
  accessToken: string,
  refreshToken: string,
  filterId: string
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  await gmail.users.settings.filters.delete({
    userId: "me",
    id: filterId,
  });
}

// ============ Message Operations (for Focus Mode) ============

export async function searchMessages(
  accessToken: string,
  refreshToken: string,
  query: string,
  maxResults: number = 100
): Promise<string[]> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  return (response.data.messages || []).map((m: any) => m.id);
}

export async function getMessage(
  accessToken: string,
  refreshToken: string,
  messageId: string,
  format: "full" | "metadata" | "minimal" = "full"
): Promise<any> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format,
  });

  return response.data;
}

export async function modifyMessage(
  accessToken: string,
  refreshToken: string,
  messageId: string,
  modifications: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
  }
): Promise<any> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: modifications,
  });

  return response.data;
}
