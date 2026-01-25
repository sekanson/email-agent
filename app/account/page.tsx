"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import {
  Loader2,
  CreditCard,
  Sparkles,
  Mail,
  FileText,
  Calendar,
  ExternalLink,
  AlertTriangle,
  Check,
  User,
  Plug,
  Trash2,
  LogOut,
  Clock,
} from "lucide-react";

interface UserData {
  email: string;
  name: string;
  picture?: string;
  subscription_status: string;
  subscription_tier: string;
  trial_ends_at: string | null;
  drafts_created_count: number;
  emails_processed?: number;
  created_at: string;
  stripe_customer_id: string | null;
}

interface Metrics {
  totalAll: number;
  toRespond?: number;
}

const FREE_DRAFT_LIMIT = 10;

type Tab = "account" | "billing" | "integrations";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      // TODO: Implement delete account API
      alert("Account deletion is not yet implemented. Please contact support@xix3d.com");
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Failed to delete account:", error);
    } finally {
      setDeleting(false);
    }
  }

  function handleSignOut() {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("userPicture");
    localStorage.removeItem("subscriptionStatus");
    localStorage.removeItem("draftsCreatedCount");
    localStorage.removeItem("emailsProcessed");
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("userRole");
    window.location.href = "/";
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

  const tabs = [
    { id: "account" as Tab, label: "Account", icon: User },
    { id: "billing" as Tab, label: "Billing", icon: CreditCard },
    { id: "integrations" as Tab, label: "Integrations", icon: Plug },
  ];

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

      <main className="ml-60 min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
          <div className="px-8 py-6">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Settings
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Manage your account, billing, and integrations
            </p>
          </div>
        </div>

        <div className="flex">
          {/* Left Tab Navigation */}
          <div className="w-48 shrink-0 border-r border-[var(--border)] p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]/50 hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8">
            <div className="max-w-2xl">
              {/* Account Tab */}
              {activeTab === "account" && (
                <div className="space-y-8">
                  {/* Profile Section */}
                  <section>
                    <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                      Profile
                    </h2>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                      <div className="flex items-start gap-5">
                        {user?.picture ? (
                          <img
                            src={user.picture}
                            alt={user.name}
                            className="h-20 w-20 rounded-full"
                          />
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-2xl font-semibold text-white">
                            {user?.name ? getInitials(user.name) : "?"}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                            {user?.name}
                          </h3>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">
                            {user?.email}
                          </p>
                          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <Clock className="h-3.5 w-3.5" />
                            Member since{" "}
                            {user?.created_at
                              ? new Date(user.created_at).toLocaleDateString("en-US", {
                                  month: "long",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Connected Account */}
                  <section>
                    <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                      Connected Account
                    </h2>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">
                              Signed in with Google
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">
                              {user?.email}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Danger Zone */}
                  <section>
                    <h2 className="mb-4 text-lg font-semibold text-red-400">
                      Danger Zone
                    </h2>
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            Delete Account
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-muted)]">
                            Permanently delete your account and all data
                          </p>
                        </div>
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete account
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {/* Billing Tab */}
              {activeTab === "billing" && (
                <div className="space-y-8">
                  {/* Current Plan */}
                  <section>
                    <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                      Current Plan
                    </h2>
                    {isProUser ? (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
                              <Sparkles className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                                  Pro Plan
                                </h3>
                                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                                  Active
                                </span>
                              </div>
                              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                                $9<span className="text-base font-normal text-[var(--text-muted)]">/month</span>
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-4 text-sm text-[var(--text-muted)]">
                          <span>Billing: Monthly</span>
                          <span>•</span>
                          <span>Unlimited drafts</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-elevated)]">
                              <Mail className="h-6 w-6 text-[var(--text-muted)]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                                  Free Plan
                                </h3>
                                <span className="rounded-full bg-zinc-500/15 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                                  Current
                                </span>
                              </div>
                              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                                $0<span className="text-base font-normal text-[var(--text-muted)]">/month</span>
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleUpgrade}
                            disabled={upgrading}
                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                          >
                            {upgrading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            Upgrade to Pro
                          </button>
                        </div>
                        <div className="mt-4 text-sm text-[var(--text-muted)]">
                          {FREE_DRAFT_LIMIT} drafts per month
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Usage Stats */}
                  <section>
                    <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                      Usage
                    </h2>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                      <div className="grid gap-6 sm:grid-cols-3">
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

                        <div>
                          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                            <FileText className="h-4 w-4" />
                            Drafts created
                          </div>
                          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                            {user?.drafts_created_count || 0}
                            {!isProUser && (
                              <span className="text-base font-normal text-[var(--text-muted)]">
                                {" "}/ {FREE_DRAFT_LIMIT}
                              </span>
                            )}
                          </p>
                          {isProUser ? (
                            <p className="text-xs text-emerald-400">Unlimited</p>
                          ) : (
                            <p className="text-xs text-[var(--text-muted)]">
                              {draftsRemaining} remaining
                            </p>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                            <Check className="h-4 w-4" />
                            Response rate
                          </div>
                          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                            {metrics?.totalAll && metrics.toRespond
                              ? Math.round(((metrics.totalAll - metrics.toRespond) / metrics.totalAll) * 100)
                              : 0}%
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">Emails handled</p>
                        </div>
                      </div>

                      {/* Progress bar for free users */}
                      {!isProUser && (
                        <div className="mt-6">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--text-muted)]">Draft usage</span>
                            <span className="text-[var(--text-primary)]">
                              {user?.drafts_created_count || 0} / {FREE_DRAFT_LIMIT}
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                draftsRemaining === 0
                                  ? "bg-red-500"
                                  : "bg-gradient-to-r from-emerald-500 to-teal-500"
                              }`}
                              style={{
                                width: `${((user?.drafts_created_count || 0) / FREE_DRAFT_LIMIT) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Payment Method - Pro users only */}
                  {isProUser && (
                    <section>
                      <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                        Payment Method
                      </h2>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                              <CreditCard className="h-5 w-5 text-[var(--text-muted)]" />
                            </div>
                            <div>
                              <p className="font-medium text-[var(--text-primary)]">
                                Card on file
                              </p>
                              <p className="text-sm text-[var(--text-muted)]">
                                Managed through Stripe
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleManageSubscription}
                            disabled={managingSubscription}
                            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                          >
                            {managingSubscription ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ExternalLink className="h-4 w-4" />
                            )}
                            Manage billing
                          </button>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Cancel Subscription - Pro users only */}
                  {isProUser && (
                    <section>
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="text-sm text-[var(--text-muted)] transition-colors hover:text-red-400"
                      >
                        Cancel subscription
                      </button>
                    </section>
                  )}
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === "integrations" && (
                <div className="space-y-8">
                  {/* Email Section */}
                  <section>
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        Email
                      </h2>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Connect email to get high-quality draft replies in your tone and a categorized inbox.
                      </p>
                    </div>

                    {/* Gmail Card */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                            <svg className="h-6 w-6" viewBox="0 0 24 24">
                              <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">Gmail</p>
                            <p className="text-sm text-[var(--text-muted)]">1 account connected</p>
                          </div>
                        </div>
                      </div>

                      {/* Connected account details */}
                      <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--bg-elevated)] p-3">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm text-[var(--text-secondary)]">{user?.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[var(--text-muted)]">
                            Connected {user?.created_at
                              ? new Date(user.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  year: "numeric",
                                })
                              : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Outlook Card - Coming Soon */}
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0078D4]">
                            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M24 7.387v10.478c0 .23-.08.424-.238.576-.16.154-.352.229-.576.229h-8.547v-6.959l1.602 1.18a.39.39 0 0 0 .264.094.39.39 0 0 0 .264-.094l.023-.02 6.078-4.456a.762.762 0 0 0 .27-.325.858.858 0 0 0 .086-.373v-.33h.774zM15.59 17.33v-5.207L24 4.669v1.668l-7.348 5.41v5.582h-1.062zm-1.062-5.996v6.336H7.387A1.387 1.387 0 0 1 6 16.283V7.717c0-.383.136-.712.407-.984.272-.271.6-.407.98-.407h6.14v4.008z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">Outlook</p>
                            <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                          </div>
                        </div>
                        <button
                          disabled
                          className="rounded-lg bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-muted)]"
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Calendar Section */}
                  <section>
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        Calendar
                      </h2>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Connect your calendar to manage your schedule using AI.
                      </p>
                    </div>

                    {/* Google Calendar Card - Coming Soon */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                            <Calendar className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">Google Calendar</p>
                            <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                          </div>
                        </div>
                        <button
                          disabled
                          className="rounded-lg bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-muted)]"
                        >
                          Connect
                        </button>
                      </div>
                    </div>

                    {/* Outlook Calendar Card - Coming Soon */}
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0078D4]">
                            <Calendar className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">Outlook Calendar</p>
                            <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                          </div>
                        </div>
                        <button
                          disabled
                          className="rounded-lg bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-muted)]"
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
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
              Are you sure you want to cancel your Pro subscription? You&apos;ll lose
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

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Delete Account</h3>
            </div>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Are you sure you want to delete your account? This action is
              permanent and cannot be undone.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                All your data will be permanently deleted
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Your email labels will remain in Gmail
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Any active subscription will be cancelled
              </li>
            </ul>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
