import { NextResponse } from "next/server";
import { verifyAdminAccess, getAuthenticatedUser, isAdmin } from "@/lib/auth";

export async function GET() {
  try {
    // Step 1: Get authenticated user
    const email = await getAuthenticatedUser();

    // Step 2: Check isAdmin
    let adminStatus = null;
    let adminError = null;
    if (email) {
      try {
        adminStatus = await isAdmin(email);
      } catch (e) {
        adminError = String(e);
      }
    }

    // Step 3: Full verifyAdminAccess
    let verifyResult = null;
    let verifyError = null;
    try {
      verifyResult = await verifyAdminAccess();
    } catch (e) {
      verifyError = String(e);
    }

    return NextResponse.json({
      step1_getAuthenticatedUser: {
        email,
      },
      step2_isAdmin: {
        result: adminStatus,
        error: adminError,
      },
      step3_verifyAdminAccess: {
        result: verifyResult,
        error: verifyError,
      },
      conclusion: verifyResult?.authorized
        ? "✅ SHOULD HAVE ADMIN ACCESS"
        : `❌ NO ADMIN ACCESS - Reason: ${verifyResult?.error || verifyError || 'unknown'}`
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
