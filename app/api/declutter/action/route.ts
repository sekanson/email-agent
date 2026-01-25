import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { google } from "googleapis";
import { ActionRequest, ActionResponse } from "@/lib/declutter-types";

export async function POST(request: NextRequest) {
  try {
    const { userEmail, senderEmail, action }: ActionRequest = await request.json();

    if (!userEmail || !senderEmail || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["keep", "unsubscribe", "block"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'keep', 'unsubscribe', or 'block'" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get the subscription
    const { data: subscription, error: fetchError } = await supabase
      .from("email_subscriptions")
      .select("*")
      .eq("user_email", userEmail)
      .eq("sender_email", senderEmail)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Determine new status based on action
    let newStatus: string;
    switch (action) {
      case "keep":
        newStatus = "kept";
        break;
      case "unsubscribe":
        newStatus = "unsubscribed";
        break;
      case "block":
        newStatus = "blocked";
        break;
      default:
        newStatus = "active";
    }

    // If blocking, create a Gmail filter to move to spam
    if (action === "block") {
      try {
        const { data: user } = await supabase
          .from("users")
          .select("access_token, refresh_token")
          .eq("email", userEmail)
          .single();

        if (user) {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );

          oauth2Client.setCredentials({
            access_token: user.access_token,
            refresh_token: user.refresh_token,
          });

          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          // Create a filter to send future emails from this sender to spam
          await gmail.users.settings.filters.create({
            userId: "me",
            requestBody: {
              criteria: {
                from: senderEmail,
              },
              action: {
                addLabelIds: ["SPAM"],
                removeLabelIds: ["INBOX"],
              },
            },
          });
        }
      } catch (filterError) {
        console.error("Error creating Gmail filter:", filterError);
        // Continue even if filter creation fails
      }
    }

    // Update the subscription in database
    const { data: updated, error: updateError } = await supabase
      .from("email_subscriptions")
      .update({
        status: newStatus,
        user_action: action,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating subscription:", updateError);
      return NextResponse.json(
        { error: "Failed to update subscription" },
        { status: 500 }
      );
    }

    const response: ActionResponse = {
      success: true,
      message: `Subscription ${action === "keep" ? "marked as kept" : action === "unsubscribe" ? "marked for unsubscribe" : "blocked"}`,
      subscription: updated,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error processing action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
