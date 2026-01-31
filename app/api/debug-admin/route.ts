import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

export async function GET() {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email;

    if (!sessionEmail) {
      return NextResponse.json({
        error: "No session - you must be signed in",
        session: null,
      });
    }

    // Query database for this user
    const supabase = createClient();

    // Get user record with all relevant fields
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("email, is_admin, role, subscription_status, subscription_tier")
      .eq("email", sessionEmail)
      .single();

    // Also try case-insensitive search
    const { data: userILike, error: iLikeError } = await supabase
      .from("users")
      .select("email, is_admin, role")
      .ilike("email", sessionEmail)
      .single();

    // Check if is_admin is exactly boolean true
    const isAdminExactCheck = user?.is_admin === true;
    const isAdminTypeOf = typeof user?.is_admin;

    return NextResponse.json({
      sessionEmail,
      exactMatchQuery: {
        user,
        error: userError?.message || null,
      },
      caseInsensitiveQuery: {
        user: userILike,
        error: iLikeError?.message || null,
      },
      analysis: {
        isAdminValue: user?.is_admin,
        isAdminType: isAdminTypeOf,
        isAdminExactlyTrue: isAdminExactCheck,
        roleValue: user?.role,
        emailsMatch: user?.email === sessionEmail,
        emailCaseDiff: user?.email !== sessionEmail ? `DB: "${user?.email}" vs Session: "${sessionEmail}"` : null,
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
