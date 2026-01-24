/**
 * Thread Detection Module
 *
 * Detects whether an email is part of an existing conversation thread.
 * Thread context is the highest priority signal for classification (Tier 0).
 * Emails in threads should NEVER be classified as Marketing/Spam.
 */

export interface ThreadSignals {
  isThread: boolean;
  signals: string[];
  confidence: number;
}

/**
 * Detect thread signals in an email
 *
 * Checks for:
 * - Subject prefixes: Re:, RE:, Fwd:, FW:
 * - Email headers: References, In-Reply-To
 * - Quoted content: Lines starting with ">"
 * - Attribution patterns: "On [date], [person] wrote:"
 * - Forward markers: "From:" in body
 */
export function detectThreadSignals(
  subject: string,
  body: string,
  references?: string,
  inReplyTo?: string
): ThreadSignals {
  const signals: string[] = [];

  // Signal 1: Subject line patterns (Re:, Fwd:, etc.)
  if (/^(Re|RE|Fwd|FW|Fw):\s*/i.test(subject)) {
    signals.push("subject_prefix");
  }

  // Signal 2: References/In-Reply-To headers (strongest signal - RFC 2822 standard)
  if (references && references.trim()) {
    signals.push("references_header");
  }
  if (inReplyTo && inReplyTo.trim()) {
    signals.push("in_reply_to_header");
  }

  // Signal 3: Quoted content (lines starting with ">")
  const quotedLineMatches = body.match(/^>/gm);
  const quotedLines = quotedLineMatches ? quotedLineMatches.length : 0;
  if (quotedLines >= 2) {
    signals.push("quoted_content");
  }

  // Signal 4: "On [date], [person] wrote:" pattern
  // Common formats: "On Jan 23, 2024, John wrote:", "On 2024-01-23 at 10:30, John wrote:"
  const wrotePattern = /On .{10,60} wrote:/i;
  if (wrotePattern.test(body)) {
    signals.push("wrote_attribution");
  }

  // Signal 5: Gmail-style forwarded attribution
  // "---------- Forwarded message ---------"
  if (/^-{5,}\s*Forwarded message\s*-{5,}/im.test(body)) {
    signals.push("forwarded_attribution");
  }

  // Signal 6: "From:" attribution in body (classic forward format)
  // Must be at line start, not just anywhere in body
  if (/^From:\s+[^\n]+\n(Sent|Date):/im.test(body)) {
    signals.push("forwarded_from_block");
  }

  const isThread = signals.length > 0;

  // Calculate confidence based on signal strength
  // Headers are strongest, subject prefix is strong, quoted content is moderate
  let confidence = 0;
  if (signals.includes("references_header")) confidence += 0.35;
  if (signals.includes("in_reply_to_header")) confidence += 0.35;
  if (signals.includes("subject_prefix")) confidence += 0.25;
  if (signals.includes("quoted_content")) confidence += 0.15;
  if (signals.includes("wrote_attribution")) confidence += 0.10;
  if (signals.includes("forwarded_attribution")) confidence += 0.15;
  if (signals.includes("forwarded_from_block")) confidence += 0.15;

  // Cap at 1.0
  confidence = Math.min(confidence, 1);

  return { isThread, signals, confidence };
}

/**
 * Determine the thread state based on the latest message content
 * Used when classifying reply threads
 */
export type ThreadState =
  | "awaiting_your_reply"    // They asked you a question
  | "they_answered"          // They answered your question
  | "they_will_follow_up"    // They said they'll get back to you
  | "just_thanks"            // Just a "thanks" or closing message
  | "calendar_discussion"    // Meeting/calendar related
  | "vendor_followup"        // Follow-up from a vendor you've engaged with
  | "unknown";

export function analyzeThreadState(body: string, subject: string): ThreadState {
  const lowerBody = body.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  // Calendar/meeting signals
  if (
    lowerSubject.includes("meeting") ||
    lowerSubject.includes("calendar") ||
    lowerSubject.includes("invite") ||
    lowerBody.includes("calendar invite") ||
    lowerBody.includes("meeting request") ||
    /\b(join|attend|rsvp)\b/i.test(lowerBody)
  ) {
    return "calendar_discussion";
  }

  // Just thanks/closing
  const thanksPatterns = [
    /^thanks[.!]?\s*$/im,
    /^thank you[.!]?\s*$/im,
    /^perfect[.!]?\s*$/im,
    /^great[.!]?\s*$/im,
    /^sounds good[.!]?\s*$/im,
    /^got it[.!]?\s*$/im,
  ];
  const shortBody = body.trim().split("\n")[0]; // First line only
  if (shortBody.length < 50 && thanksPatterns.some((p) => p.test(shortBody))) {
    return "just_thanks";
  }

  // They will follow up
  if (
    /i('ll| will) (get back|follow up|send|check|look into)/i.test(lowerBody) ||
    /let me (check|look|get back)/i.test(lowerBody)
  ) {
    return "they_will_follow_up";
  }

  // Question detection - they asked you something
  const hasQuestion =
    lowerBody.includes("?") ||
    /\b(can you|could you|would you|do you|are you|will you|please)\b/i.test(body);

  if (hasQuestion) {
    return "awaiting_your_reply";
  }

  // They answered/provided info
  if (
    /\b(here('s| is)|attached|see below|as requested|per your request)\b/i.test(body)
  ) {
    return "they_answered";
  }

  return "unknown";
}
