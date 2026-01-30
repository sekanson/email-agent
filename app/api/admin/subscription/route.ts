import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { verifyAdminAccess } from "@/lib/auth";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const { authorized, userEmail: adminEmail, error } = await verifyAdminAccess();

    if (!authorized) {
      if (!adminEmail) {
        return unauthorizedResponse(error || "Please sign in");
      }
      return forbiddenResponse(error || "Admin access required");
    }

    const { targetUserEmail, action } = await request.json();

    if (!targetUserEmail || !action) {
      return NextResponse.json(
        { error: "Target user email and action are required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get target user (only fields needed for subscription management)
    const { data: targetUser, error: targetError } = await supabase
      .from("users")
      .select("email, stripe_subscription_id, stripe_customer_id, subscription_status")
      .eq("email", targetUserEmail)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const stripe = getStripe();

    switch (action) {
      case "cancel": {
        if (!targetUser.stripe_subscription_id) {
          return NextResponse.json(
            { error: "User has no active subscription" },
            { status: 400 }
          );
        }

        // Cancel subscription at period end
        await stripe.subscriptions.update(targetUser.stripe_subscription_id, {
          cancel_at_period_end: true,
        });

        // Update database
        await supabase
          .from("users")
          .update({ subscription_status: "cancelled" })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Subscription will be cancelled at end of billing period",
        });
      }

      case "cancel_immediately": {
        if (!targetUser.stripe_subscription_id) {
          return NextResponse.json(
            { error: "User has no active subscription" },
            { status: 400 }
          );
        }

        // Cancel subscription immediately
        await stripe.subscriptions.cancel(targetUser.stripe_subscription_id);

        // Update database
        await supabase
          .from("users")
          .update({
            subscription_status: "cancelled",
            stripe_subscription_id: null,
          })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Subscription cancelled immediately",
        });
      }

      case "pause": {
        if (!targetUser.stripe_subscription_id) {
          return NextResponse.json(
            { error: "User has no active subscription" },
            { status: 400 }
          );
        }

        // Pause subscription (Stripe pauses collection)
        await stripe.subscriptions.update(targetUser.stripe_subscription_id, {
          pause_collection: { behavior: "void" },
        });

        // Update database
        await supabase
          .from("users")
          .update({ subscription_status: "paused" })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Subscription paused",
        });
      }

      case "resume": {
        if (!targetUser.stripe_subscription_id) {
          return NextResponse.json(
            { error: "User has no subscription to resume" },
            { status: 400 }
          );
        }

        // Resume subscription
        await stripe.subscriptions.update(targetUser.stripe_subscription_id, {
          pause_collection: null,
          cancel_at_period_end: false,
        });

        // Update database
        await supabase
          .from("users")
          .update({ subscription_status: "active" })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Subscription resumed",
        });
      }

      case "extend_trial": {
        // Extend trial by 14 days
        const newTrialEnd = new Date();
        newTrialEnd.setDate(newTrialEnd.getDate() + 14);

        await supabase
          .from("users")
          .update({
            trial_ends_at: newTrialEnd.toISOString(),
            subscription_status: "trial",
          })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Trial extended by 14 days",
        });
      }

      case "grant_pro": {
        // Grant pro status without Stripe (for special cases)
        await supabase
          .from("users")
          .update({
            subscription_status: "active",
            subscription_tier: "pro",
          })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Pro status granted",
        });
      }

      case "revoke_pro": {
        // Revoke pro status
        await supabase
          .from("users")
          .update({
            subscription_status: "trial",
            subscription_tier: "free",
          })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Pro status revoked",
        });
      }

      case "reset_drafts": {
        // Reset draft count
        await supabase
          .from("users")
          .update({ drafts_created_count: 0 })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Draft count reset to 0",
        });
      }

      case "grant_admin": {
        // Grant admin access
        await supabase
          .from("users")
          .update({ is_admin: true })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Admin access granted",
        });
      }

      case "revoke_admin": {
        // Prevent revoking own admin access
        if (targetUserEmail === adminEmail) {
          return NextResponse.json(
            { error: "Cannot revoke your own admin access" },
            { status: 400 }
          );
        }

        await supabase
          .from("users")
          .update({ is_admin: false })
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "Admin access revoked",
        });
      }

      case "delete_user": {
        // Prevent deleting own account
        if (targetUserEmail === adminEmail) {
          return NextResponse.json(
            { error: "Cannot delete your own account" },
            { status: 400 }
          );
        }

        // Delete user's emails first (foreign key constraint)
        await supabase
          .from("emails")
          .delete()
          .eq("user_email", targetUserEmail);

        // Delete user settings
        await supabase
          .from("user_settings")
          .delete()
          .eq("user_email", targetUserEmail);

        // Also try with email column
        await supabase
          .from("user_settings")
          .delete()
          .eq("email", targetUserEmail);

        // Cancel Stripe subscription if exists
        if (targetUser.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(targetUser.stripe_subscription_id);
          } catch (e) {
            console.log("Stripe subscription already cancelled or not found");
          }
        }

        // Delete user
        await supabase
          .from("users")
          .delete()
          .eq("email", targetUserEmail);

        return NextResponse.json({
          success: true,
          message: "User deleted",
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Admin subscription error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process action" },
      { status: 500 }
    );
  }
}
