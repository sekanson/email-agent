import { NextRequest, NextResponse } from "next/server";

// This endpoint is called after deployment to trigger a label test
// It notifies Mirmi (via webhook) to run the test script

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const testKey = process.env.TEST_API_KEY;
    
    if (!testKey || authHeader !== `Bearer ${testKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { testId } = await request.json();
    
    // Notify Clawdbot to run the test
    const clawdbotWebhook = process.env.CLAWDBOT_WEBHOOK_URL;
    if (clawdbotWebhook) {
      await fetch(clawdbotWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "run_label_test",
          testId,
          deploymentUrl: process.env.VERCEL_URL,
          timestamp: new Date().toISOString(),
        }),
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      testId,
      message: "Test triggered - Mirmi will run the labeling test"
    });
  } catch (error: any) {
    console.error("Test trigger error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
