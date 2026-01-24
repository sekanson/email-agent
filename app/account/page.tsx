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
  Clock,
  AlertTriangle,
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

const FREE_DRAFT_LIMIT = 10;

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const userEmail =
    typeof window !== "undefined"
      ? localStorage.getItem("userEmail") || ""
      : "";

  useEffect(() => {
    if (userEmail) {
      fetchUserData();
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

  const isProUser = user?.subscription_status === "active";
  const isTrialUser = user?.subscription_status === "trial";
  const draftsRemaining = Math.max(
    0,
    FREE_DRAFT_LIMIT - (user?.drafts_created_count || 0)
  );

  // Calculate trial days remaining
  const getTrialDaysRemaining = () => {
    if (!user?.trial_ends_at) return null;
    const trialEnd = new Date(user.trial_ends_at);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  const trialDaysRemaining = getTrialDaysRemaining();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-64 flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-[var(--text-muted)]">Loading account...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-64 flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Not signed in
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Please sign in to access account settings.
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

      <main className="ml-64 min-h-screen overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
          <div className="px-8 py-5">
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Account Settings
            </h1>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Manage your subscription and account details
            </p>
          </div>
        </div>

        <div className="p-8">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Trial Banner */}
            {isTrialUser && trialDaysRemaining !== null && (
              <div
                className={`rounded-xl border p-4 ${
                  trialDaysRemaining <= 7
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-blue-500/30 bg-blue-500/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {trialDaysRemaining <= 7 ? (
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                    ) : (
                      <Clock className="h-5 w-5 text-blue-400" />
                    )}
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          trialDaysRemaining <= 7 ? "text-amber-300" : "text-blue-300"
                        }`}
                      >
                        {trialDaysRemaining > 0
                          ? `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""} left in trial`
                          : "Trial expired"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {trialDaysRemaining > 0
                          ? "Upgrade now to keep unlimited access"
                          : "Upgrade to continue using all features"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all disabled:opacity-50 ${
                      trialDaysRemaining <= 7
                        ? "bg-amber-500 hover:bg-amber-600"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    Upgrade
                  </button>
                </div>
              </div>
            )}

            {/* Subscription Card */}
            <div className="glass-card overflow-hidden">
              <div className="border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Subscription
                </h2>
              </div>

              <div className="p-6">
                {isProUser ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)]">
                          Pro Plan
                        </h3>
                        <p className="text-sm text-emerald-400">Active</p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg bg-[var(--bg-elevated)] p-4">
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">Drafts Created</span>
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                          {user?.drafts_created_count || 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[var(--bg-elevated)] p-4">
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                          <Shield className="h-4 w-4" />
                          <span className="text-sm">Draft Limit</span>
                        </div>
                        <p className="mt-1 text-2xl font-semibold text-emerald-400">
                          Unlimited
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleManageSubscription}
                      disabled={managingSubscription}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-elevated)]"
                    >
                      {managingSubscription ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Manage Subscription
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-elevated)]">
                        <Mail className="h-6 w-6 text-[var(--text-muted)]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)]">
                          Free Plan
                        </h3>
                        <p className="text-sm text-[var(--text-muted)]">
                          {draftsRemaining > 0
                            ? `${draftsRemaining} drafts remaining`
                            : "Draft limit reached"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--text-muted)]">Draft usage</span>
                        <span className="text-[var(--text-secondary)]">
                          {user?.drafts_created_count || 0} / {FREE_DRAFT_LIMIT}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            draftsRemaining === 0
                              ? "bg-red-500"
                              : "bg-gradient-to-r from-blue-500 to-purple-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              ((user?.drafts_created_count || 0) / FREE_DRAFT_LIMIT) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {draftsRemaining === 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                        <p className="text-sm text-amber-300">
                          You've reached your free draft limit. Upgrade to Pro for unlimited
                          AI-generated email drafts.
                        </p>
                      </div>
                    )}

                    <div className="rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6">
                      <h4 className="font-semibold text-[var(--text-primary)]">
                        Upgrade to Pro
                      </h4>
                      <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                        <li className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-400" />
                          Unlimited AI-generated drafts
                        </li>
                        <li className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-purple-400" />
                          Priority email processing
                        </li>
                        <li className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-purple-400" />
                          Advanced classification features
                        </li>
                      </ul>
                      <button
                        onClick={handleUpgrade}
                        disabled={upgrading}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3 text-sm font-medium text-white transition-all hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
                      >
                        {upgrading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Upgrade Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Account Info Card */}
            <div className="glass-card overflow-hidden">
              <div className="border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Account Details
                </h2>
              </div>

              <div className="divide-y divide-[var(--border)]">
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-sm text-[var(--text-muted)]">Email</span>
                  <span className="text-sm text-[var(--text-primary)]">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-sm text-[var(--text-muted)]">Name</span>
                  <span className="text-sm text-[var(--text-primary)]">{user?.name}</span>
                </div>
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-sm text-[var(--text-muted)]">Member since</span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-sm text-[var(--text-muted)]">Total drafts created</span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {user?.drafts_created_count || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
