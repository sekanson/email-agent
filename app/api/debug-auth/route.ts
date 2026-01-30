import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // Get all cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieNames = allCookies.map(c => c.name);

    // Check for NextAuth cookies specifically
    const hasSessionToken = cookieNames.some(name =>
      name.includes('next-auth.session-token') ||
      name.includes('__Secure-next-auth.session-token')
    );

    // Try to get session
    const session = await getServerSession(authOptions);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      cookieNames,
      hasSessionToken,
      session: session ? {
        user: session.user,
        expires: session.expires,
      } : null,
      env: {
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        nodeEnv: process.env.NODE_ENV,
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
