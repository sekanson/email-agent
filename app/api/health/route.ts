import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

/**
 * GET /api/health
 * 
 * Health check endpoint for monitoring and deploy verification
 */
export async function GET() {
  const startTime = Date.now();
  
  let dbStatus = "unknown";
  let dbLatency = 0;
  
  try {
    const supabase = createClient();
    const dbStart = Date.now();
    
    // Simple query to verify DB connection
    const { error } = await supabase
      .from("users")
      .select("email")
      .limit(1);
    
    dbLatency = Date.now() - dbStart;
    dbStatus = error ? "error" : "connected";
  } catch (error) {
    dbStatus = "error";
  }

  const response = {
    status: dbStatus === "connected" ? "ok" : "degraded",
    version: process.env.npm_package_version || "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? Math.floor(process.uptime()) : null,
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
      },
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClaudeKey: !!process.env.ANTHROPIC_API_KEY,
      },
    },
    responseTimeMs: Date.now() - startTime,
  };

  return NextResponse.json(response, {
    status: response.status === "ok" ? 200 : 503,
  });
}
