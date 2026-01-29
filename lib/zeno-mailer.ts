import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.ZENO_SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.ZENO_SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.ZENO_SMTP_USER,
    pass: process.env.ZENO_SMTP_PASS,
  },
});

export interface DigestEmail {
  to: string;
  userName: string;
  digestType: "morning" | "eod" | "weekly" | "urgent";
  needsAttention: Array<{
    id: string;
    from: string;
    fromEmail: string;
    subject: string;
    snippet: string;
    category: number;
    urgencyReason?: string;
    suggestedReplies?: string[];
  }>;
  summary?: {
    totalProcessed: number;
    byCategory: Record<number, number>;
    draftsCreated: number;
  };
}

export interface ActionEmail {
  to: string;
  userName: string;
  action: string;
  result: string;
  originalRequest: string;
}

const DIGEST_TITLES = {
  morning: "🌅 Morning Brief",
  eod: "🌙 End of Day Wrap-up",
  weekly: "📊 Weekly Digest",
  urgent: "🚨 Urgent: Action Required",
};

// Personalized greetings based on digest type and time
function getGreeting(userName: string, digestType: string): string {
  const hour = new Date().getHours();
  const firstName = userName.split(" ")[0];
  
  switch (digestType) {
    case "morning":
      return `Good morning, ${firstName}! ☀️`;
    case "eod":
      if (hour >= 17) return `Wrapping up the day, ${firstName}!`;
      return `Here's your afternoon update, ${firstName}`;
    case "weekly":
      return `We had a great week, ${firstName}! 🎉`;
    case "urgent":
      return `Heads up, ${firstName} — this needs your attention`;
    default:
      return `Hey ${firstName}!`;
  }
}

const CATEGORY_NAMES: Record<number, string> = {
  1: "Reply Needed",
  2: "For Info",
  3: "Mentions",
  4: "Notifications",
  5: "Calendar",
  6: "Waiting",
  7: "Actioned!",
  8: "Ad/Spam",
};

const CATEGORY_EMOJI: Record<number, string> = {
  1: "📩",
  2: "📋",
  3: "💬",
  4: "🔔",
  5: "📅",
  6: "⏳",
  7: "✅",
  8: "🗑️",
};

function generateDigestHtml(data: DigestEmail): string {
  const title = DIGEST_TITLES[data.digestType];
  const greeting = getGreeting(data.userName, data.digestType);
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build numbered email items
  let emailItems = "";
  data.needsAttention.forEach((email, index) => {
    const num = index + 1;
    const urgencyBadge = email.urgencyReason 
      ? `<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">⚡ ${email.urgencyReason}</span>`
      : "";

    // Extract first name from sender
    const senderName = email.from.split('<')[0].trim() || email.from;

    emailItems += `
      <div style="border-left: 3px solid #3b82f6; padding: 12px 16px; margin-bottom: 12px; background: #fafafa; border-radius: 0 8px 8px 0;">
        <div style="display: flex; align-items: center; margin-bottom: 6px;">
          <span style="background: #3b82f6; color: white; font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 13px; margin-right: 10px;">${num}</span>
          <strong style="color: #111;">${senderName}</strong>
          ${urgencyBadge}
        </div>
        <div style="font-weight: 600; color: #111; margin-bottom: 4px; margin-left: 32px;">${email.subject}</div>
        <div style="color: #6b7280; font-size: 14px; margin-left: 32px;">"${email.snippet?.slice(0, 120) || ""}..."</div>
      </div>
    `;
  });

  // Build quick reply options based on the emails
  let quickReplies = "";
  if (data.needsAttention.length > 0) {
    const replyOptions: string[] = [];

    data.needsAttention.forEach((email, index) => {
      const num = index + 1;
      const firstName = email.from.split(' ')[0].split('<')[0].trim();

      // Create a smart suggested action for each email
      if (email.suggestedReplies && email.suggestedReplies[0]) {
        replyOptions.push(`<strong>${num}</strong> — ${email.suggestedReplies[0]}`);
      } else if (email.category === 5) {
        replyOptions.push(`<strong>${num}</strong> — Confirm the meeting with ${firstName}`);
      } else {
        replyOptions.push(`<strong>${num}</strong> — Reply to ${firstName}`);
      }
    });

    quickReplies = `
      <div style="margin-bottom: 16px;">
        <div style="color: #374151; font-size: 14px; margin-bottom: 12px;">Reply with a number to take action:</div>
        ${replyOptions.map(opt => `<div style="margin-bottom: 8px; color: #4b5563; font-size: 14px;">${opt}</div>`).join("")}
      </div>
    `;
  }

  // Summary section for non-urgent digests
  let summarySection = "";
  if (data.summary && data.digestType !== "urgent") {
    const categoryBreakdown = Object.entries(data.summary.byCategory)
      .filter(([, count]) => count > 0)
      .map(([cat, count]) => `${CATEGORY_EMOJI[parseInt(cat)] || "📧"} ${CATEGORY_NAMES[parseInt(cat)] || "Other"}: ${count}`)
      .join(" • ");

    summarySection = `
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-weight: 600; margin-bottom: 8px;">📊 Summary</div>
        <div style="color: #6b7280; font-size: 14px;">
          ${data.summary.totalProcessed} emails processed • ${data.summary.draftsCreated} drafts created<br/>
          ${categoryBreakdown}
        </div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111;">
  
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 500; color: #374151;">${greeting}</h2>
    <h1 style="margin: 0; font-size: 24px;">${title}</h1>
    <p style="color: #6b7280; margin: 4px 0 0 0;">${date}</p>
  </div>

  ${summarySection}

  ${data.needsAttention.length > 0 ? `
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 14px; color: #6b7280; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px;">
        ${data.digestType === "urgent" ? "🚨 Requires Immediate Attention" : "📬 Needs Your Attention"}
      </h2>
      ${emailItems}
    </div>
  ` : `
    <div style="text-align: center; padding: 40px; color: #6b7280;">
      <p style="font-size: 18px;">✨ All clear!</p>
      <p>No emails requiring your attention right now.</p>
    </div>
  `}

  ${data.needsAttention.length > 0 ? `
  <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin-top: 24px;">
    <div style="font-weight: 600; margin-bottom: 12px;">💡 Quick reply</div>
    ${quickReplies}
    <div style="color: #6b7280; font-size: 13px; border-top: 1px solid #dbeafe; padding-top: 12px;">
      You can also reply normally with your own instructions.
    </div>
  </div>
  ` : ''}

  <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 12px;">
      Zeno Email Agent • <a href="https://zeno.xix3d.com/settings" style="color: #3b82f6;">Manage Settings</a>
    </p>
  </div>

</body>
</html>
  `;
}

function generateDigestText(data: DigestEmail): string {
  const title = DIGEST_TITLES[data.digestType];
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let text = `${title}\n${date}\n${"=".repeat(40)}\n\n`;

  if (data.summary && data.digestType !== "urgent") {
    text += `SUMMARY\n`;
    text += `${data.summary.totalProcessed} emails processed, ${data.summary.draftsCreated} drafts created\n\n`;
  }

  if (data.needsAttention.length > 0) {
    text += `NEEDS ATTENTION (${data.needsAttention.length})\n`;
    text += `${"-".repeat(40)}\n`;
    
    data.needsAttention.forEach((email, index) => {
      const num = index + 1;
      text += `\n${num}. ${email.from}\n`;
      text += `   Subject: ${email.subject}\n`;
      text += `   ${email.snippet?.slice(0, 100) || ""}...\n`;
      if (email.suggestedReplies) {
        email.suggestedReplies.forEach((reply, i) => {
          text += `   [Reply ${i + 1}]: "${reply.slice(0, 40)}..."\n`;
        });
      }
    });
  } else {
    text += `\n✨ All clear! No emails requiring your attention.\n`;
  }

  text += `\n${"=".repeat(40)}\n`;
  text += `Quick reply - reply with a number to take action:\n\n`;

  data.needsAttention.forEach((email, index) => {
    const num = index + 1;
    const firstName = email.from.split(' ')[0].split('<')[0].trim();
    if (email.suggestedReplies && email.suggestedReplies[0]) {
      text += `${num} — ${email.suggestedReplies[0]}\n`;
    } else {
      text += `${num} — Reply to ${firstName}\n`;
    }
  });

  text += `\nOr reply normally with your own instructions.\n`;

  return text;
}

export async function sendDigestEmail(data: DigestEmail): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const subject = `${DIGEST_TITLES[data.digestType]} - ${new Date().toLocaleDateString()}`;
    
    const info = await transporter.sendMail({
      from: `"Zeno Email Agent" <${process.env.ZENO_SMTP_USER}>`,
      to: data.to,
      subject,
      text: generateDigestText(data),
      html: generateDigestHtml(data),
      replyTo: process.env.ZENO_SMTP_USER, // Replies come back to Zeno
    });

    console.log("Digest email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("Failed to send digest email:", error);
    return { success: false, error: error.message };
  }
}

export async function sendActionConfirmation(data: ActionEmail): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">✅ Action Completed</h2>
  
  <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">YOUR REQUEST</div>
    <div style="color: #111;">${data.originalRequest}</div>
  </div>

  <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <div style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">WHAT I DID</div>
    <div style="color: #111;">${data.result}</div>
  </div>

  <p style="color: #6b7280; font-size: 14px;">
    Reply if you need anything else!
  </p>

  <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
    <p style="color: #9ca3af; font-size: 12px;">Zeno Email Agent</p>
  </div>
</body>
</html>
    `;

    const info = await transporter.sendMail({
      from: `"Zeno Email Agent" <${process.env.ZENO_SMTP_USER}>`,
      to: data.to,
      subject: `✅ Done: ${data.action}`,
      text: `Action Completed\n\nYour request: ${data.originalRequest}\n\nWhat I did: ${data.result}`,
      html,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("Failed to send action confirmation:", error);
    return { success: false, error: error.message };
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log("SMTP connection verified");
    return true;
  } catch (error) {
    console.error("SMTP connection failed:", error);
    return false;
  }
}
