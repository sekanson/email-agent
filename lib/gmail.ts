import { google } from "googleapis";

export interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  bodyPreview: string;
  body: string;
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

    emails.push({
      id: message.id!,
      threadId: message.threadId!,
      subject: getHeader("subject"),
      from: getHeader("from"),
      to: getHeader("to"),
      date: getHeader("date"),
      bodyPreview: msg.data.snippet || "",
      body,
    });
  }

  return emails;
}

// Gmail's allowed label color palette (verified from API)
// These are the ONLY colors Gmail accepts for labels
const GMAIL_ALLOWED_COLORS = [
  { bg: "#fb4c2f", text: "#ffffff" }, // Red
  { bg: "#cc3a21", text: "#ffffff" }, // Dark Red
  { bg: "#ffad47", text: "#ffffff" }, // Orange
  { bg: "#fad165", text: "#000000" }, // Yellow
  { bg: "#16a766", text: "#ffffff" }, // Green
  { bg: "#43d692", text: "#000000" }, // Light Green
  { bg: "#4a86e8", text: "#ffffff" }, // Blue
  { bg: "#a479e2", text: "#ffffff" }, // Purple
  { bg: "#f691b3", text: "#000000" }, // Pink
  { bg: "#2da2bb", text: "#ffffff" }, // Cyan/Teal
  { bg: "#b99aff", text: "#000000" }, // Light Purple
  { bg: "#ff7537", text: "#ffffff" }, // Orange-Red
];

// Map user's hex colors to closest Gmail allowed color
const COLOR_MAPPING: Record<string, number> = {
  // Original mappings
  "#ef4444": 0,  // Red -> fb4c2f
  "#f59e0b": 2,  // Amber -> ffad47
  "#10b981": 4,  // Green -> 16a766
  "#6366f1": 6,  // Indigo -> 4a86e8
  "#8b5cf6": 7,  // Purple -> a479e2
  "#06b6d4": 9,  // Cyan -> 2da2bb
  "#84cc16": 5,  // Lime -> 43d692
  "#f97316": 11, // Orange -> ff7537
  "#ec4899": 8,  // Pink -> f691b3
  "#14b8a6": 9,  // Teal -> 2da2bb
  // New category colors
  "#f87171": 0,  // Respond (red) -> fb4c2f
  "#fb923c": 11, // Update (orange) -> ff7537
  "#22d3ee": 9,  // Comment (cyan) -> 2da2bb
  "#4ade80": 5,  // Notification (green) -> 43d692
  "#a855f7": 7,  // Calendar (purple) -> a479e2
  "#60a5fa": 6,  // Pending (blue) -> 4a86e8
  "#2dd4bf": 9,  // Complete (teal) -> 2da2bb
  "#f472b6": 8,  // Marketing/Spam (pink) -> f691b3
  "#9ca3af": 6,  // Other (gray) -> 4a86e8 (blue as fallback)
};

function getGmailColor(hexColor: string): { backgroundColor: string; textColor: string } {
  const colorIndex = COLOR_MAPPING[hexColor.toLowerCase()];
  if (colorIndex !== undefined) {
    const color = GMAIL_ALLOWED_COLORS[colorIndex];
    return { backgroundColor: color.bg, textColor: color.text };
  }
  // Default to blue if no match
  return { backgroundColor: "#4a86e8", textColor: "#ffffff" };
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
  threadId: string
): Promise<string> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  // Check if body contains HTML (signature or formatting)
  const isHtml = /<[^>]+>/.test(body);

  let formattedBody: string;
  let contentType: string;

  if (isHtml) {
    // Wrap in HTML structure for proper rendering
    // Convert plain text portions to HTML (newlines to <br>)
    const htmlBody = body
      .split(/(<[^>]+>)/g) // Split preserving HTML tags
      .map(part => {
        // If it's an HTML tag, keep as-is
        if (part.startsWith('<')) return part;
        // Otherwise convert newlines to <br>
        return part.replace(/\n/g, '<br>');
      })
      .join('');

    formattedBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; font-size: 14px;">
${htmlBody}
</body>
</html>`;
    contentType = "text/html; charset=utf-8";
  } else {
    formattedBody = body;
    contentType = "text/plain; charset=utf-8";
  }

  // Build the raw email message
  const message = [
    `To: ${to}`,
    `Subject: Re: ${subject.replace(/^Re:\s*/i, "")}`,
    `Content-Type: ${contentType}`,
    "",
    formattedBody,
  ].join("\n");

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

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
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
