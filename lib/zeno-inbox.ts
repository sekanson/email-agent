import Imap from "imap-simple";
import { simpleParser, ParsedMail } from "mailparser";

interface IncomingReply {
  messageId: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  date: Date;
}

const imapConfig = {
  imap: {
    user: process.env.ZENO_SMTP_USER || "",
    password: process.env.ZENO_SMTP_PASS || "",
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 10000,
  },
};

// Extract email address from "Name <email>" format
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase();
}

// Extract plain text body from email
function extractPlainText(parsed: ParsedMail): string {
  if (parsed.text) {
    // Remove quoted reply content (everything after "On ... wrote:")
    const lines = parsed.text.split("\n");
    const cleanLines: string[] = [];
    
    for (const line of lines) {
      // Stop at reply quote markers
      if (line.match(/^On .+ wrote:$/i) || 
          line.match(/^>/) ||
          line.match(/^-{3,}/) ||
          line.match(/^From:/i) ||
          line.includes("zenoemailagent@")) {
        break;
      }
      cleanLines.push(line);
    }
    
    return cleanLines.join("\n").trim();
  }
  return "";
}

// Fetch unread replies from Zeno's inbox
export async function fetchUnreadReplies(): Promise<IncomingReply[]> {
  let connection: Imap.ImapSimple | null = null;
  
  try {
    connection = await Imap.connect(imapConfig);
    await connection.openBox("INBOX");

    // Search for unread emails
    const searchCriteria = ["UNSEEN"];
    const fetchOptions = {
      bodies: ["HEADER", "TEXT", ""],
      markSeen: false, // Don't mark as read yet
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    const replies: IncomingReply[] = [];

    for (const message of messages) {
      try {
        const all = message.parts.find((part) => part.which === "");
        if (!all?.body) continue;

        const parsed = await simpleParser(all.body);
        
        // Extract sender info
        const fromHeader = parsed.from?.text || "";
        const fromEmail = extractEmail(fromHeader);
        
        // Skip if it's from ourselves (not a reply)
        if (fromEmail.includes("zenoemailagent")) continue;

        const reply: IncomingReply = {
          messageId: parsed.messageId || "",
          from: fromHeader,
          fromEmail,
          subject: parsed.subject || "",
          body: extractPlainText(parsed),
          inReplyTo: parsed.inReplyTo as string | undefined,
          date: parsed.date || new Date(),
        };

        // Only include if there's actual content
        if (reply.body.trim().length > 0) {
          replies.push(reply);
        }
      } catch (parseError) {
        console.error("Failed to parse message:", parseError);
      }
    }

    return replies;

  } catch (error) {
    console.error("IMAP fetch error:", error);
    throw error;
  } finally {
    if (connection) {
      connection.end();
    }
  }
}

// Mark a message as read after processing
export async function markAsRead(messageId: string): Promise<void> {
  let connection: Imap.ImapSimple | null = null;
  
  try {
    connection = await Imap.connect(imapConfig);
    await connection.openBox("INBOX");

    // Search for the specific message
    const searchCriteria = [["HEADER", "MESSAGE-ID", messageId]];
    const messages = await connection.search(searchCriteria, { bodies: [] });

    if (messages.length > 0) {
      const uid = messages[0].attributes.uid;
      await connection.addFlags(uid, ["\\Seen"]);
      console.log(`Marked message ${messageId} as read`);
    }

  } catch (error) {
    console.error("Failed to mark as read:", error);
  } finally {
    if (connection) {
      connection.end();
    }
  }
}

// Move processed message to a "Processed" label
export async function archiveMessage(messageId: string): Promise<void> {
  let connection: Imap.ImapSimple | null = null;
  
  try {
    connection = await Imap.connect(imapConfig);
    await connection.openBox("INBOX");

    const searchCriteria = [["HEADER", "MESSAGE-ID", messageId]];
    const messages = await connection.search(searchCriteria, { bodies: [] });

    if (messages.length > 0) {
      const uid = messages[0].attributes.uid;
      // Mark as read and move to archive
      await connection.addFlags(uid, ["\\Seen"]);
      // Note: Moving to label requires IMAP MOVE extension or copy+delete
    }

  } catch (error) {
    console.error("Failed to archive message:", error);
  } finally {
    if (connection) {
      connection.end();
    }
  }
}

// Test IMAP connection
export async function testImapConnection(): Promise<boolean> {
  let connection: Imap.ImapSimple | null = null;
  
  try {
    connection = await Imap.connect(imapConfig);
    await connection.openBox("INBOX");
    console.log("✅ IMAP connection successful");
    return true;
  } catch (error) {
    console.error("❌ IMAP connection failed:", error);
    return false;
  } finally {
    if (connection) {
      connection.end();
    }
  }
}
