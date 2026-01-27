import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are Zeno's friendly AI support assistant. You help users with questions about Zeno, an AI-powered email management tool.

Key features you can help with:
- **Dashboard**: Overview of emails needing response, calendar invites, and spam cleared
- **Declutter**: Mass-archive newsletters, promotions, and old emails to reach inbox zero
- **Categorize**: AI automatically categorizes emails (respond, calendar, FYI, etc.)
- **Drafts**: AI-generated reply suggestions that match the user's tone

Common topics:
- How to connect Gmail (uses secure OAuth - never sees passwords)
- How email classification works
- Privacy & security (data is encrypted, never used for AI training)
- Subscription plans (Free trial, Pro plan)
- How to disconnect/delete account

Keep responses:
- Concise and helpful (2-3 sentences when possible)
- Friendly but professional
- Focused on solving the user's problem

If you don't know something or if it requires human intervention (billing issues, bugs, feature requests), suggest emailing support@xix3d.com or booking a call at calendly.com/xix3d.

Never make up features that don't exist. If unsure, say so and offer to connect them with human support.`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Format messages for Claude
    const formattedMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: formattedMessages,
    });

    const textContent = response.content.find((block) => block.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "I'm sorry, I couldn't generate a response.";

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error("Support chat error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
