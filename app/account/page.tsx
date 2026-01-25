"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import {
  Loader2,
  CreditCard,
  Sparkles,
  Mail,
  FileText,
  Calendar,
  Shield,
  ExternalLink,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";

interface UserData {
  email: string;
  name: string;
  picture?: string;
  subscription_status: string;
  subscription_tier: string;
  trial_ends_at: string | null;
  drafts_created_count: number;
  created_at: string;
  stripe_customer_id: string | null;
}

interface Metrics {
  totalAll: number;
}

const FREE_DRAFT_LIMIT = 10;

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const userEmail =
    typeof window !== "undefined"
      ? localStorage.getItem("userEmail") || ""
      : "";

  useEffect(() => {
    if (userEmail) {
      fetchUserData();
      fetchMetrics();
    } else {
      setLoading(false);
    }
  }, [userEmail]);

  async function fetchUserData() {
    try {
      const res = await fetch(`/api/settings?userEmail=${userEmail}`);
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetrics() {
    try {
      const res = await fetch(`/api/emails?userEmail=${userEmail}&limit=1`);
      const data = await res.json();
      if (data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    }
  }

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to start checkout:", error);
    } finally {
      setUpgrading(false);
    }
  }

  async function handleManageSubscription() {
    setManagingSubscription(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to open portal:", error);
    } finally {
      setManagingSubscription(false);
    }
  }

  async function handleCancelSubscription() {
    setCancelling(true);
    try {
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("subscriptionStatus", "cancelled");
        setUser((prev) =>
          prev ? { ...prev, subscription_status: "cancelled" } : null
        );
        setShowCancelModal(false);
      } else {
        alert(data.error || "Failed to cancel subscription");
      }
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      alert("Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  }

  const isProUser = user?.subscription_status === "active";
  const draftsRemaining = Math.max(
    0,
    FREE_DRAFT_LIMIT - (user?.drafts_created_count || 0)
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-60 flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-[var(--text-muted)]">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-60 flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Not signed in
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Please sign in to access settings.
            </p>
            <a
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white"
            >
              Go to Home
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      <main className="ml-60 min-h-screen overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
          <div className="px-8 py-6">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Settings
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Manage your account and subscription
            </p>
          </div>
        </div>

        <div className="p-8">
          <div className="mx-auto max-w-2xl space-y-8">
            {/* Section 1: Account Info */}
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Account
              </h2>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                <div className="flex items-start gap-4">
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="h-16 w-16 rounded-full"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xl font-semibold text-white">
                      {user?.name ? getInitials(user.name) : "?"}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                      {user?.name}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">
                      {user?.email}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Member since{" "}
                      {user?.created_at
                        ? new Date(user.created_at).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Usage Stats */}
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Usage
              </h2>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Emails Processed */}
                  <div>
                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <Mail className="h-4 w-4" />
                      Emails processed
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                      {metrics?.totalAll || 0}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">All time</p>
                  </div>

                  {/* Drafts */}
                  <div>
                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                      <FileText className="h-4 w-4" />
                      Drafts created
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                      {user?.drafts_created_count || 0}
                      {!isProUser && (
                        <span className="text-base font-normal text-[var(--text-muted)]">
                          {" "}
                          / {FREE_DRAFT_LIMIT}
                        </span>
                      )}
                    </p>
                    {!isProUser && (
                      <>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              draftsRemaining === 0
                                ? "bg-red-500"
                                : "bg-gradient-to-r from-blue-500 to-purple-500"
                            }`}
                            style={{
                              width: `${
                                ((user?.drafts_created_count || 0) /
                                  FREE_DRAFT_LIMIT) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                          {draftsRemaining > 0
                            ? `${draftsRemaining} drafts remaining`
                            : "Limit reached"}
                        </p>
                      </>
                    )}
                    {isProUser && (
                      <p className="text-xs text-emerald-400">Unlimited</p>
                    )}
                  </div>
                </div>

                {/* Upgrade prompt for free users */}
                {!isProUser && draftsRemaining <= 3 && (
                  <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-300">
                      {draftsRemaining === 0
                        ? "You've reached your free draft limit."
                        : `Only ${draftsRemaining} draft${draftsRemaining === 1 ? "" : "s"} remaining.`}{" "}
                      Upgrade to Pro for unlimited AI-generated drafts.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Section 3: Subscription */}
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Subscription
              </h2>

              {isProUser ? (
                /* Pro User Card */
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[var(--text-primary)]">
                          Pro Plan
                        </h3>
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          Active
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">
                        Unlimited drafts & priority processing
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={handleManageSubscription}
                      disabled={managingSubscription}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                    >
                      {managingSubscription ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Manage billing
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <X className="h-4 w-4" />
                      Cancel subscription
                    </button>
                  </div>
                </div>
              ) : (
                /* Free User - Upgrade Card */
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-br from-blue-500/5 to-purple-500/5">
                  <div className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                        <Mail className="h-5 w-5 text-[var(--text-muted)]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[var(--text-primary)]">
                            Free Plan
                          </h3>
                          <span className="rounded bg-zinc-500/15 px-2 py-0.5 text-xs font-medium text-zinc-400">
                            Current
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">
                          {FREE_DRAFT_LIMIT} drafts per month
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] bg-[var(--bg-card)] p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                          <Sparkles className="h-4 w-4 text-purple-400" />
                          Upgrade to Pro
                        </h4>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          $9/month
                        </p>
                      </div>
                      <button
                        onClick={handleUpgrade}
                        disabled={upgrading}
                        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-5 py-2.5 text-sm font-medium text-white transition-all hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
                      >
                        {upgrading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Upgrade
                      </button>
                    </div>

                    <ul className="mt-4 space-y-2">
                      <li className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Unlimited AI-generated drafts
                      </li>
                      <li className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Priority email processing
                      </li>
                      <li className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Advanced classification features
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </section>

            {/* Section 4: Billing History */}
            {isProUser && (
              <section>
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Billing
                </h2>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                  <p className="text-sm text-[var(--text-secondary)]">
                    View your invoices, update payment method, or download
                    receipts from the billing portal.
                  </p>
                  <button
                    onClick={handleManageSubscription}
                    disabled={managingSubscription}
                    className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                  >
                    {managingSubscription ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Open billing portal
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Cancel Subscription</h3>
            </div>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Are you sure you want to cancel your Pro subscription? You'll lose
              access to:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Unlimited AI-generated drafts
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Priority email processing
              </li>
            </ul>
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Your subscription will remain active until the end of your current
              billing period.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                Keep subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Cancel subscription"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
