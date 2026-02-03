import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-utils";

export async function POST() {
  try {
    const authenticatedEmail = await getAuthenticatedUser();
    if (!authenticatedEmail) {
      return unauthorizedResponse("Please sign in");
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("users")
      .update({ 
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq("email", authenticatedEmail);

    if (error) {
      console.error("Error updating onboarding status:", error);
      return NextResponse.json(
        { error: "Failed to save" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in onboarding-complete:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
