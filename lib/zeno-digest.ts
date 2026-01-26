/**
 * Zeno Digest — Email notification templates
 * 
 * Generates the emails Zeno sends to users surfacing important
 * emails and requesting instructions.
 */

import { ClassificationResult } from "./claude";

export interface DigestEmail {
  id: string;
  from: string;
  subject: string;
  bodyPreview: string;
  classification: ClassificationResult;
  suggestedActions: SuggestedAction[];
  receivedAt: Date;
}

export interface SuggestedAction {
  type: "draft_reply" | "book_meeting" | "send_response" | "archive" | "forward";
  label: string;
  description: string;
  requiresInput?: boolean;
  inputPrompt?: string;
}

export interface DigestConfig {
  userName: string;
  userEmail: string;
  appUrl: string;
  maxEmails?: number;
}

/**
 * Get category emoji and color
 */
function getCategoryStyle(category: number): { emoji: string; color: string; label: string } {
  const styles: Record<number, { emoji: string; color: string; label: string }> = {
    1: { emoji: "🔴", color: "#F87171", label: "Respond" },
    2: { emoji: "🟠", color: "#FB923C", label: "Update" },
    3: { emoji: "💬", color: "#22D3EE", label: "Comment" },
    4: { emoji: "🔔", color: "#4ADE80", label: "Notification" },
    5: { emoji: "📅", color: "#A855F7", label: "Calendar" },
    6: { emoji: "⏳", color: "#60A5FA", label: "Pending" },
    7: { emoji: "✅", color: "#2DD4BF", label: "Complete" },
    8: { emoji: "📢", color: "#F472B6", label: "Marketing" },
  };
  return styles[category] || { emoji: "📧", color: "#9CA3AF", label: "Other" };
}

/**
 * Generate suggested actions based on email classification
 */
export function generateSuggestedActions(
  email: DigestEmail
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const category = email.classification.category;

  // Category 1: Respond — needs reply
  if (category === 1) {
    actions.push({
      type: "draft_reply",
      label: "Draft a reply",
      description: "I'll create a draft response for you to review",
      requiresInput: true,
      inputPrompt: "Any specific points you want me to address?",
    });

    // Check if it might warrant a meeting
    const meetingKeywords = ["discuss", "call", "meet", "sync", "chat", "talk"];
    const mightNeedMeeting = meetingKeywords.some(
      (kw) =>
        email.subject.toLowerCase().includes(kw) ||
        email.bodyPreview.toLowerCase().includes(kw)
    );

    if (mightNeedMeeting) {
      actions.push({
        type: "book_meeting",
        label: "Suggest a meeting",
        description: "I'll check your calendar and propose times",
      });
    }
  }

  // Category 5: Calendar — meeting request
  if (category === 5) {
    actions.push({
      type: "send_response",
      label: "Accept",
      description: "Accept this meeting invite",
    });
    actions.push({
      type: "send_response",
      label: "Decline",
      description: "Decline this meeting invite",
    });
    actions.push({
      type: "send_response",
      label: "Propose new time",
      description: "Suggest alternative times based on your availability",
    });
  }

  // Category 6: Pending — waiting on someone
  if (category === 6) {
    actions.push({
      type: "draft_reply",
      label: "Send follow-up",
      description: "I'll draft a polite follow-up message",
    });
  }

  // For most categories, offer to archive
  if (category !== 1 && category !== 5 && category !== 6) {
    actions.push({
      type: "archive",
      label: "Archive",
      description: "Move out of inbox",
    });
  }

  return actions;
}

/**
 * Generate HTML for a single email card in the digest
 */
function generateEmailCard(email: DigestEmail, index: number): string {
  const style = getCategoryStyle(email.classification.category);
  const actions = generateSuggestedActions(email);

  const actionButtons = actions
    .map(
      (action, i) => `
      <a href="{{ACTION_URL}}?email=${email.id}&action=${action.type}&index=${i}" 
         style="display: inline-block; padding: 8px 16px; margin: 4px; 
                background: ${i === 0 ? "#3B82F6" : "#E5E7EB"}; 
                color: ${i === 0 ? "#FFFFFF" : "#374151"}; 
                text-decoration: none; border-radius: 6px; font-size: 14px;">
        ${action.label}
      </a>
    `
    )
    .join("");

  return `
    <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; 
                padding: 20px; margin-bottom: 16px; border-left: 4px solid ${style.color};">
      
      <!-- Header -->
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 20px; margin-right: 8px;">${style.emoji}</span>
        <span style="background: ${style.color}20; color: ${style.color}; 
                     padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">
          ${style.label}
        </span>
        <span style="margin-left: auto; color: #9CA3AF; font-size: 12px;">
          ${email.receivedAt.toLocaleString()}
        </span>
      </div>

      <!-- From & Subject -->
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; color: #111827; font-size: 16px;">
          ${escapeHtml(email.subject)}
        </div>
        <div style="color: #6B7280; font-size: 14px; margin-top: 4px;">
          From: ${escapeHtml(email.from)}
        </div>
      </div>

      <!-- Preview -->
      <div style="color: #4B5563; font-size: 14px; line-height: 1.5; 
                  background: #F9FAFB; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
        ${escapeHtml(email.bodyPreview.slice(0, 200))}${email.bodyPreview.length > 200 ? "..." : ""}
      </div>

      <!-- AI Insight -->
      ${
        email.classification.reasoning
          ? `
        <div style="color: #6B7280; font-size: 13px; font-style: italic; margin-bottom: 12px;">
          💡 ${escapeHtml(email.classification.reasoning)}
        </div>
      `
          : ""
      }

      <!-- Actions -->
      <div style="margin-top: 12px;">
        ${actionButtons}
      </div>
    </div>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate the full digest email HTML
 */
export function generateDigestEmail(
  emails: DigestEmail[],
  config: DigestConfig
): { subject: string; html: string; text: string } {
  const maxEmails = config.maxEmails || 10;
  const displayEmails = emails.slice(0, maxEmails);

  // Count by priority
  const respondCount = emails.filter((e) => e.classification.category === 1).length;
  const calendarCount = emails.filter((e) => e.classification.category === 5).length;
  const totalCount = emails.length;

  // Count pending too
  const pendingCount = emails.filter((e) => e.classification.category === 6).length;

  // Generate subject (avoid emoji in subject line - email encoding issues)
  let subject = `Zeno: `;
  if (respondCount > 0) {
    subject += `${respondCount} email${respondCount > 1 ? "s" : ""} need${respondCount === 1 ? "s" : ""} your attention`;
  } else if (calendarCount > 0) {
    subject += `${calendarCount} calendar item${calendarCount > 1 ? "s" : ""} to review`;
  } else {
    subject += `${totalCount} email${totalCount > 1 ? "s" : ""} processed`;
  }

  // Generate email cards
  const emailCards = displayEmails.map((email, i) => generateEmailCard(email, i)).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
             background: #F3F4F6; margin: 0; padding: 20px;">
  
  <div style="max-width: 600px; margin: 0 auto;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #111827; font-size: 24px; margin: 0;">
        ⚡ Zeno Email Agent
      </h1>
      <p style="color: #6B7280; margin-top: 8px;">
        Here's what needs your attention
      </p>
    </div>

    <!-- Summary Bar (table for email compatibility) -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #FFFFFF; border-radius: 12px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 16px; text-align: center; width: 25%;">
          <div style="font-size: 24px; font-weight: 700; color: #EF4444;">${respondCount}</div>
          <div style="font-size: 12px; color: #6B7280;">Respond</div>
        </td>
        <td style="padding: 16px; text-align: center; width: 25%;">
          <div style="font-size: 24px; font-weight: 700; color: #60A5FA;">${pendingCount}</div>
          <div style="font-size: 12px; color: #6B7280;">Pending</div>
        </td>
        <td style="padding: 16px; text-align: center; width: 25%;">
          <div style="font-size: 24px; font-weight: 700; color: #A855F7;">${calendarCount}</div>
          <div style="font-size: 12px; color: #6B7280;">Calendar</div>
        </td>
        <td style="padding: 16px; text-align: center; width: 25%;">
          <div style="font-size: 24px; font-weight: 700; color: #3B82F6;">${totalCount}</div>
          <div style="font-size: 12px; color: #6B7280;">Total</div>
        </td>
      </tr>
    </table>

    <!-- Quick Reply Instructions -->
    <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; 
                padding: 16px; margin-bottom: 20px;">
      <div style="font-weight: 600; color: #1E40AF; margin-bottom: 8px;">
        💬 Quick Reply Mode
      </div>
      <div style="color: #1E40AF; font-size: 14px; line-height: 1.5;">
        Reply to this email with instructions like:<br>
        <code style="background: #DBEAFE; padding: 2px 6px; border-radius: 4px;">#1: draft a polite decline</code><br>
        <code style="background: #DBEAFE; padding: 2px 6px; border-radius: 4px;">#2: accept the meeting</code><br>
        <code style="background: #DBEAFE; padding: 2px 6px; border-radius: 4px;">#3: book a call for next week</code>
      </div>
    </div>

    <!-- Email Cards -->
    ${emailCards}

    ${
      emails.length > maxEmails
        ? `
      <div style="text-align: center; padding: 16px; color: #6B7280;">
        + ${emails.length - maxEmails} more emails in your inbox
      </div>
    `
        : ""
    }

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; padding: 20px; color: #9CA3AF; font-size: 12px;">
      <a href="${config.appUrl}/dashboard" style="color: #3B82F6; text-decoration: none;">
        Open Zeno Dashboard
      </a>
      <span style="margin: 0 8px;">•</span>
      <a href="${config.appUrl}/settings" style="color: #3B82F6; text-decoration: none;">
        Notification Settings
      </a>
      <p style="margin-top: 12px;">
        Zeno Email Agent — Your AI inbox assistant
      </p>
    </div>

  </div>
</body>
</html>
  `;

  // Plain text version
  const text = `
ZENO EMAIL DIGEST
==================

${respondCount} emails need your response
${calendarCount} calendar items
${totalCount} total emails processed

---

${displayEmails
  .map(
    (email, i) => `
[${i + 1}] ${getCategoryStyle(email.classification.category).label.toUpperCase()}
From: ${email.from}
Subject: ${email.subject}
${email.bodyPreview.slice(0, 150)}...

Reply with "#${i + 1}: [your instruction]" to take action.
---
`
  )
  .join("")}

Open dashboard: ${config.appUrl}/dashboard

---
Zeno Email Agent — Your AI inbox assistant
  `.trim();

  return { subject, html, text };
}

/**
 * Generate a single-email notification (for real-time important emails)
 */
export function generateUrgentNotification(
  email: DigestEmail,
  config: DigestConfig
): { subject: string; html: string; text: string } {
  const style = getCategoryStyle(email.classification.category);
  const actions = generateSuggestedActions(email);

  const subject = `⚡ Urgent: ${email.subject.slice(0, 50)}${email.subject.length > 50 ? "..." : ""}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
             background: #F3F4F6; margin: 0; padding: 20px;">
  
  <div style="max-width: 600px; margin: 0 auto;">
    
    <div style="background: #FEF2F2; border: 2px solid #FCA5A5; border-radius: 12px; 
                padding: 16px; margin-bottom: 20px; text-align: center;">
      <span style="font-size: 32px;">${style.emoji}</span>
      <div style="font-weight: 700; color: #991B1B; margin-top: 8px;">
        This email looks important
      </div>
    </div>

    ${generateEmailCard(email, 0).replace("{{ACTION_URL}}", `${config.appUrl}/action`)}

    <div style="background: #EFF6FF; border-radius: 12px; padding: 16px; margin-top: 20px;">
      <div style="color: #1E40AF; font-size: 14px;">
        <strong>Reply to this email</strong> with instructions:<br>
        "Draft a response saying..." or "Book a meeting for next week"
      </div>
    </div>

  </div>
</body>
</html>
  `;

  const text = `
⚡ URGENT EMAIL DETECTED

From: ${email.from}
Subject: ${email.subject}
Category: ${style.label}

${email.bodyPreview}

---

${email.classification.reasoning ? `AI Note: ${email.classification.reasoning}` : ""}

Suggested actions:
${actions.map((a) => `- ${a.label}: ${a.description}`).join("\n")}

Reply to this email with instructions to take action.
  `.trim();

  return { subject, html, text };
}
