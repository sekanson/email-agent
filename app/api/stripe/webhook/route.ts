import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = createClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userEmail = session.metadata?.user_email;

        console.log("Checkout completed:", { customerId, subscriptionId, userEmail });

        if (userEmail) {
          await supabase
            .from("users")
            .update({
              subscription_status: "active",
              subscription_tier: "pro",
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq("email", userEmail);

          console.log(`User ${userEmail} upgraded to pro`);
        } else {
          // Fallback: find user by customer ID
          const { data: user } = await supabase
            .from("users")
            .select("email")
            .eq("stripe_customer_id", customerId)
            .single();

          if (user) {
            await supabase
              .from("users")
              .update({
                subscription_status: "active",
                subscription_tier: "pro",
                stripe_subscription_id: subscriptionId,
                updated_at: new Date().toISOString(),
              })
              .eq("email", user.email);

            console.log(`User ${user.email} upgraded to pro (via customer ID)`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log("Subscription deleted:", { customerId });

        // Find user by customer ID and downgrade
        const { data: user } = await supabase
          .from("users")
          .select("email")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabase
            .from("users")
            .update({
              subscription_status: "cancelled",
              subscription_tier: "trial",
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("email", user.email);

          console.log(`User ${user.email} subscription cancelled`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log("Payment failed:", { customerId });

        // Find user by customer ID and mark as past due
        const { data: user } = await supabase
          .from("users")
          .select("email")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabase
            .from("users")
            .update({
              subscription_status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("email", user.email);

          console.log(`User ${user.email} payment failed - marked as past due`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        console.log("Subscription updated:", { customerId, status });

        // Find user by customer ID
        const { data: user } = await supabase
          .from("users")
          .select("email")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          let subscriptionStatus = "active";
          if (status === "past_due") subscriptionStatus = "past_due";
          else if (status === "canceled" || status === "unpaid") subscriptionStatus = "cancelled";
          else if (status === "active") subscriptionStatus = "active";

          await supabase
            .from("users")
            .update({
              subscription_status: subscriptionStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("email", user.email);

          console.log(`User ${user.email} subscription status: ${subscriptionStatus}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
