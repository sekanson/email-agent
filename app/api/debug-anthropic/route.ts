import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ 
      error: "No ANTHROPIC_API_KEY set",
      keyPresent: false 
    });
  }
  
  // Show key prefix (safe to show first few chars)
  const keyPrefix = apiKey.substring(0, 12) + "...";
  
  try {
    const anthropic = new Anthropic({ apiKey });
    
    // Make a minimal API call to test the key
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 10,
      messages: [{ role: "user", content: "Say 'OK'" }],
    });
    
    return NextResponse.json({
      success: true,
      keyPrefix,
      message: "API key is working!",
      response: response.content[0],
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; error?: { type?: string; message?: string }; headers?: { get?: (key: string) => string | null } };
    
    // Extract org ID from error headers if available
    let orgId = "unknown";
    if (err.headers && typeof err.headers.get === 'function') {
      orgId = err.headers.get('anthropic-organization-id') || "unknown";
    }
    
    return NextResponse.json({
      success: false,
      keyPrefix,
      error: err.message || "Unknown error",
      errorType: err.error?.type,
      errorMessage: err.error?.message,
      organizationId: orgId,
      status: err.status,
      hint: orgId !== "unknown" 
        ? `This key belongs to org ${orgId}. Make sure this org has credits!`
        : "Could not determine organization ID",
    });
  }
}
