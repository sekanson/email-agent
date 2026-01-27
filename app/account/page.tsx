"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  notification_preferences?: {
    timezone?: string;
    quiet_hours_start?: string;
    quiet_hours_end?: string;
  };
  // Integration status
  gmail_connected?: boolean;
  gmail_connected_at?: string;
  calendar_connected?: boolean;
  calendar_connected_at?: string;
}

interface Metrics {
  totalAll: number;
  toRespond?: number;
}

const FREE_DRAFT_LIMIT = 10;

type Tab = "account" | "billing" | "integrations";

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("account");

  // Read tab from URL query params (e.g., ?tab=integrations)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["account", "billing", "integrations"].includes(tabParam)) {
      setActiveTab(tabParam as Tab);
    }
  }, [searchParams]);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState<"gmail" | "calendar" | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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

  async function handleDisconnect(type: "gmail" | "calendar") {
    setDisconnecting(true);
    try {
      const endpoint = type === "gmail" ? "/api/integrations/gmail" : "/api/integrations/calendar";
      const res = await fetch(`${endpoint}?userEmail=${userEmail}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Update local state
        setUser((prev: any) => prev ? {
          ...prev,
          [`${type}_connected`]: false,
          [`${type}_connected_at`]: null,
        } : prev);
        setShowDisconnectModal(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to disconnect");
      }
    } catch (error) {
      console.error(`Failed to disconnect ${type}:`, error);
      alert("Failed to disconnect. Please try again.");
    } finally {
      setDisconnecting(false);
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
        <main className="flex min-h-screen items-center justify-center pb-20 pt-14 lg:ml-60 lg:pb-0 lg:pt-0">
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
        <main className="flex min-h-screen items-center justify-center px-4 pb-20 pt-14 lg:ml-60 lg:pb-0 lg:pt-0">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Not signed in
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Please sign in to access settings.
            </p>
            <a
              href="/"
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white"
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

      <main className="min-h-screen pb-20 pt-14 lg:ml-60 lg:pb-0 lg:pt-0">
        {/* Header */}
        <div className="sticky top-14 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl lg:top-0">
          <div className="px-4 py-4 sm:px-8 sm:py-6">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
              Settings
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Manage your account, billing, and integrations
            </p>
          </div>

          {/* Mobile Tab Navigation - Horizontal scroll */}
          <div className="-mx-px overflow-x-auto px-4 sm:hidden">
            <nav className="flex gap-1 pb-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex min-h-[44px] flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
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
        </div>

        <div className="flex">
          {/* Desktop Left Tab Navigation */}
          <div className="hidden w-36 shrink-0 border-r border-[var(--border)] p-3 sm:block">
            <nav className="space-y-0.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
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
          <div className="flex-1 p-4 sm:p-6">
            <div className="max-w-xl">
              {/* Account Tab */}
              {activeTab === "account" && (
                <div className="space-y-6 sm:space-y-8">
                  {/* Profile Section */}
                  <section>
                    <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)] sm:mb-4 sm:text-lg">
                      Profile
                    </h2>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6">
                      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
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
                          <h3 className="text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
                            {user?.name}
                          </h3>
                          <p className="mt-1 break-all text-sm text-[var(--text-muted)]">
                            {user?.email}
                          </p>
                          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)] sm:justify-start">
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
                    <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)] sm:mb-4 sm:text-lg">
                      Connected Account
                    </h2>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 sm:gap-4">
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
                            <p className="break-all text-sm text-[var(--text-muted)]">
                              {user?.email}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleSignOut}
                          className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] sm:min-h-0 sm:border-0 sm:px-2"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Danger Zone */}
                  <section>
                    <h2 className="mb-3 text-base font-semibold text-red-400 sm:mb-4 sm:text-lg">
                      Danger Zone
                    </h2>
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                          className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 sm:min-h-0 sm:py-2"
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
                <div className="space-y-6 sm:space-y-8">
                  {/* Current Plan */}
                  <section>
                    <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)] sm:mb-4 sm:text-lg">
                      Current Plan
                    </h2>
                    {isProUser ? (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
                              <Sparkles className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                                  Pro Plan
                                </h3>
                                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                                  Active
                                </span>
                              </div>
                              <p className="mt-1 text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                                $9<span className="text-sm font-normal text-[var(--text-muted)] sm:text-base">/month</span>
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)] sm:gap-4">
                          <span>Billing: Monthly</span>
                          <span className="hidden sm:inline">•</span>
                          <span>Unlimited drafts</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--bg-elevated)]">
                              <Mail className="h-6 w-6 text-[var(--text-muted)]" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                                  Free Plan
                                </h3>
                                <span className="rounded-full bg-zinc-500/15 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                                  Current
                                </span>
                              </div>
                              <p className="mt-1 text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                                $0<span className="text-sm font-normal text-[var(--text-muted)] sm:text-base">/month</span>
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleUpgrade}
                            disabled={upgrading}
                            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 sm:min-h-0 sm:py-2.5"
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
                    <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)] sm:mb-4 sm:text-lg">
                      Usage
                    </h2>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] sm:text-sm">
                            <Mail className="h-4 w-4" />
                            <span className="hidden sm:inline">Emails processed</span>
                            <span className="sm:hidden">Processed</span>
                          </div>
                          <p className="mt-1 text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
                            {metrics?.totalAll || 0}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">All time</p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] sm:text-sm">
                            <FileText className="h-4 w-4" />
                            <span className="hidden sm:inline">Drafts created</span>
                            <span className="sm:hidden">Drafts</span>
                          </div>
                          <p className="mt-1 text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
                            {user?.drafts_created_count || 0}
                            {!isProUser && (
                              <span className="text-sm font-normal text-[var(--text-muted)] sm:text-base">
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

                        <div className="col-span-2 sm:col-span-1">
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] sm:text-sm">
                            <Check className="h-4 w-4" />
                            Response rate
                          </div>
                          <p className="mt-1 text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">
                            {metrics?.totalAll && metrics.toRespond
                              ? Math.round(((metrics.totalAll - metrics.toRespond) / metrics.totalAll) * 100)
                              : 0}%
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">Emails handled</p>
                        </div>
                      </div>

                      {/* Progress bar for free users */}
                      {!isProUser && (
                        <div className="mt-4 sm:mt-6">
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
                      <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)] sm:mb-4 sm:text-lg">
                        Payment Method
                      </h2>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
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
                            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50 sm:min-h-0 sm:py-2"
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
                        className="min-h-[44px] text-sm text-[var(--text-muted)] transition-colors hover:text-red-400 sm:min-h-0"
                      >
                        Cancel subscription
                      </button>
                    </section>
                  )}
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === "integrations" && (
                <div className="space-y-6 sm:space-y-8">
                  {/* Email Section */}
                  <section>
                    <div className="mb-3 sm:mb-4">
                      <h2 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
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
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                            <svg className="h-7 w-7" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.288 21H1.712C.768 21 0 20.232 0 19.288V4.712C0 3.768.768 3 1.712 3h20.576C23.232 3 24 3.768 24 4.712v14.576c0 .944-.768 1.712-1.712 1.712z"/>
                              <path fill="#FFFFFF" d="M5.89 8.65l6.11 4.32 6.11-4.32v-1.9L12 11.07 5.89 6.75z"/>
                              <path fill="#EA4335" d="M23.04 5.25L12 13.47.96 5.25C.35 5.81 0 6.6 0 7.5v9c0 1.93 1.57 3.5 3.5 3.5h17c1.93 0 3.5-1.57 3.5-3.5v-9c0-.9-.35-1.69-.96-2.25z" opacity="0"/>
                              <path fill="#EA4335" d="M5.89 8.65l6.11 4.32 6.11-4.32v-1.9L12 11.07 5.89 6.75z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">Gmail</p>
                            {user?.gmail_connected !== false ? (
                              <p className="flex items-center gap-1.5 text-sm text-emerald-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                1 account connected
                              </p>
                            ) : (
                              <p className="text-sm text-[var(--text-muted)]">Not connected</p>
                            )}
                          </div>
                        </div>
                        {user?.gmail_connected === false && (
                          <a
                            href="/api/integrations/gmail"
                            className="min-h-[44px] rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] sm:min-h-0"
                          >
                            Connect
                          </a>
                        )}
                      </div>

                      {/* Connected account details - only show if connected */}
                      {user?.gmail_connected !== false && (
                        <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                          <div className="flex items-center gap-3">
                            <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">{user?.email}</p>
                              <p className="text-xs text-[var(--text-muted)]">
                                Connected {user?.gmail_connected_at
                                  ? new Date(user.gmail_connected_at).toLocaleDateString("en-US", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : user?.created_at
                                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowDisconnectModal("gmail")}
                            className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                            title="Disconnect Gmail"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* Trust messaging for non-connected state */}
                      {user?.gmail_connected === false && (
                        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                          <p className="text-xs text-[var(--text-muted)]">
                            <span className="font-medium text-[var(--text-secondary)]">🔒 Your data is safe:</span>{" "}
                            Zeno drafts emails but never sends without your approval. Your data is never used to train AI models.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Outlook Card - Coming Soon */}
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                            {/* Official Outlook Logo */}
                            <svg className="h-7 w-7" viewBox="0 0 24 24">
                              <path fill="#0A2767" d="M22.62 4.83L12 11.45 1.38 4.83A.5.5 0 0 1 1.85 4h20.3a.5.5 0 0 1 .47.83z"/>
                              <path fill="#0078D4" d="M22.5 4H1.5A1.5 1.5 0 0 0 0 5.5v13A1.5 1.5 0 0 0 1.5 20h21a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 22.5 4z"/>
                              <path fill="#28A8EA" d="M12 13L1.38 6.17A1.5 1.5 0 0 1 1.5 4h21a1.5 1.5 0 0 1 .12 2.17L12 13z"/>
                              <path fill="#0078D4" d="M8.5 18a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z"/>
                              <path fill="#FFFFFF" d="M8.5 10.5c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">Outlook</p>
                            <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                          </div>
                        </div>
                        <button
                          disabled
                          className="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] sm:min-h-0"
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Calendar Section */}
                  <section>
                    <div className="mb-3 sm:mb-4">
                      <h2 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                        Calendar
                      </h2>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Connect your calendar to manage your schedule using AI.
                      </p>
                    </div>

                    {/* Google Calendar Card */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                            <svg className="h-7 w-7" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10 10-4.48 10-10z" opacity="0.1"/>
                              <path fill="#4285F4" d="M19.5 4.5H4.5v15h15v-15z" opacity="0"/>
                              <path fill="#1A73E8" d="M19 4H5c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h14c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zm-1 14H6V8h12v10z"/>
                              <path fill="#EA4335" d="M11 10h2v6h-2z"/>
                              <path fill="#FBBC04" d="M8 13h2v3H8z"/>
                              <path fill="#34A853" d="M14 11h2v5h-2z"/>
                              <path fill="#1A73E8" d="M6 6h12v2H6z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">Google Calendar</p>
                            {user?.calendar_connected !== false ? (
                              <p className="flex items-center gap-1.5 text-sm text-emerald-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                1 account connected
                              </p>
                            ) : (
                              <p className="text-sm text-[var(--text-muted)]">Not connected</p>
                            )}
                          </div>
                        </div>
                        {user?.calendar_connected === false && (
                          <a
                            href="/api/integrations/calendar"
                            className="min-h-[44px] rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] sm:min-h-0"
                          >
                            Connect
                          </a>
                        )}
                      </div>

                      {/* Connected account details - only show if connected */}
                      {user?.calendar_connected !== false && (
                        <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                          <div className="flex items-center gap-3">
                            <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">{user?.email}</p>
                              <p className="text-xs text-[var(--text-muted)]">
                                Connected {user?.calendar_connected_at
                                  ? new Date(user.calendar_connected_at).toLocaleDateString("en-US", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : user?.created_at
                                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowDisconnectModal("calendar")}
                            className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                            title="Disconnect calendar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Timezone Setting */}
                    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 sm:mt-4 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                            <Clock className="h-5 w-5 text-[var(--accent)]" />
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">Timezone</p>
                            <p className="text-sm text-[var(--text-muted)]">Used for scheduling meetings</p>
                          </div>
                        </div>
                        <select
                          value={user?.notification_preferences?.timezone || "America/New_York"}
                          onChange={async (e) => {
                            const newTimezone = e.target.value;
                            try {
                              await fetch("/api/user/preferences", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ timezone: newTimezone }),
                              });
                              setUser((prev: any) => prev ? {
                                ...prev,
                                notification_preferences: {
                                  ...prev.notification_preferences,
                                  timezone: newTimezone,
                                },
                              } : null);
                            } catch (error) {
                              console.error("Failed to update timezone:", error);
                            }
                          }}
                          className="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none sm:min-h-0"
                        >
                          <option value="America/New_York">Eastern (EST/EDT)</option>
                          <option value="America/Chicago">Central (CST/CDT)</option>
                          <option value="America/Denver">Mountain (MST/MDT)</option>
                          <option value="America/Los_Angeles">Pacific (PST/PDT)</option>
                          <option value="America/Toronto">Toronto (EST/EDT)</option>
                          <option value="Europe/London">London (GMT/BST)</option>
                          <option value="Europe/Paris">Paris (CET/CEST)</option>
                          <option value="Asia/Tokyo">Tokyo (JST)</option>
                          <option value="Asia/Dubai">Dubai (GST)</option>
                          <option value="Australia/Sydney">Sydney (AEST/AEDT)</option>
                        </select>
                      </div>
                    </div>

                    {/* Outlook Calendar Card - Coming Soon */}
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#0078D4] shadow-sm">
                            <svg className="h-7 w-7" viewBox="0 0 24 24">
                              <path fill="#FFFFFF" d="M19 4H5c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h14c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zm-1 14H6V8h12v10z"/>
                              <path fill="#FFFFFF" d="M11 10h2v6h-2zM8 13h2v3H8zM14 11h2v5h-2zM6 6h12v2H6z" opacity="0.7"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">Outlook Calendar</p>
                            <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                          </div>
                        </div>
                        <button
                          disabled
                          className="min-h-[44px] rounded-lg bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] sm:min-h-0"
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* CRM Section */}
                  <section>
                    <div className="mb-3 sm:mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                          CRM
                        </h2>
                        <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                          Beta
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Connect your CRM to sync contacts and log email activity.
                      </p>
                    </div>

                    {/* Monday.com Card - Coming Soon */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                            {/* Monday.com Logo */}
                            <svg className="h-7 w-7" viewBox="0 0 24 24">
                              <circle fill="#FF3D57" cx="5" cy="12" r="3"/>
                              <circle fill="#FFCB00" cx="12" cy="12" r="3"/>
                              <circle fill="#00CA72" cx="19" cy="12" r="3"/>
                              <circle fill="#FF3D57" cx="5" cy="5" r="2"/>
                              <circle fill="#FFCB00" cx="12" cy="5" r="2"/>
                              <circle fill="#00CA72" cx="19" cy="5" r="2"/>
                              <circle fill="#FF3D57" cx="5" cy="19" r="2"/>
                              <circle fill="#FFCB00" cx="12" cy="19" r="2"/>
                              <circle fill="#00CA72" cx="19" cy="19" r="2"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">Monday.com</p>
                            <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                          </div>
                        </div>
                        <button
                          disabled
                          className="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] sm:min-h-0"
                        >
                          Connect
                        </button>
                      </div>
                    </div>

                    {/* HubSpot Card - Coming Soon */}
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#FF7A59] shadow-sm">
                            {/* HubSpot Logo */}
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#FFFFFF">
                              <path d="M18.16 7.58v3.24c-.46-.27-.99-.43-1.56-.43-1.73 0-3.13 1.47-3.13 3.28 0 1.81 1.4 3.28 3.13 3.28.57 0 1.1-.16 1.56-.43v.38c0 .21.17.38.38.38h1.49c.21 0 .38-.17.38-.38V7.58c0-.21-.17-.38-.38-.38h-1.49c-.21 0-.38.17-.38.38zm-1.56 7.75c-.96 0-1.74-.82-1.74-1.83 0-1.01.78-1.83 1.74-1.83s1.74.82 1.74 1.83c0 1.01-.78 1.83-1.74 1.83z"/>
                              <circle cx="8.5" cy="13.5" r="3"/>
                              <path d="M8.5 8.5v2M8.5 16.5v2"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">HubSpot</p>
                            <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                          </div>
                        </div>
                        <button
                          disabled
                          className="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] sm:min-h-0"
                        >
                          Connect
                        </button>
                      </div>
                    </div>

                    {/* Salesforce Card - Coming Soon */}
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#00A1E0] shadow-sm">
                            {/* Salesforce Logo */}
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#FFFFFF">
                              <path d="M10.5 5.5c1.1-.7 2.4-1 3.8-1 2.2 0 4.1 1 5.4 2.5.9-.4 1.9-.6 2.9-.6 3.6 0 6.4 2.9 6.4 6.4 0 3.6-2.9 6.4-6.4 6.4-.5 0-1-.1-1.5-.2-.9 1.5-2.5 2.5-4.4 2.5-1.2 0-2.3-.4-3.2-1.1-.9 1.1-2.3 1.8-3.8 1.8-2.8 0-5-2.2-5-5 0-1.1.4-2.2 1-3-.6-.8-1-1.8-1-2.9 0-2.8 2.2-5 5-5 1.1 0 2.1.3 2.9.9z"/>
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">Salesforce</p>
                            <p className="text-sm text-[var(--text-muted)]">Coming soon</p>
                          </div>
                        </div>
                        <button
                          disabled
                          className="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] sm:min-h-0"
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl border-t border-[var(--border)] bg-[var(--bg-primary)] p-4 shadow-2xl sm:mx-4 sm:rounded-2xl sm:border sm:p-6">
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
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                Unlimited AI-generated drafts
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                Priority email processing
              </li>
            </ul>
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Your subscription will remain active until the end of your current
              billing period.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="min-h-[48px] flex-1 rounded-lg border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] sm:min-h-0 sm:py-2.5"
              >
                Keep subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="min-h-[48px] flex-1 rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50 sm:min-h-0 sm:py-2.5"
              >
                {cancelling ? "Cancelling..." : "Cancel subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Integration Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl border-t border-[var(--border)] bg-[var(--bg-primary)] p-4 shadow-2xl sm:mx-4 sm:rounded-2xl sm:border sm:p-6">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">
                Disconnect {showDisconnectModal === "gmail" ? "Gmail" : "Calendar"}
              </h3>
            </div>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Are you sure you want to disconnect your {showDisconnectModal === "gmail" ? "Gmail" : "Google Calendar"} integration?
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                {showDisconnectModal === "gmail" 
                  ? "Zeno will no longer be able to read or draft emails"
                  : "Zeno will no longer be able to book meetings"}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                Your account and other integrations will remain active
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                You can reconnect at any time
              </li>
            </ul>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                onClick={() => setShowDisconnectModal(null)}
                className="min-h-[48px] flex-1 rounded-lg border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] sm:min-h-0 sm:py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDisconnect(showDisconnectModal)}
                disabled={disconnecting}
                className="min-h-[48px] flex-1 rounded-lg bg-amber-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50 sm:min-h-0 sm:py-2.5"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl border-t border-[var(--border)] bg-[var(--bg-primary)] p-4 shadow-2xl sm:mx-4 sm:rounded-2xl sm:border sm:p-6">
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
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                All your data will be permanently deleted
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                Your email labels will remain in Gmail
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                Any active subscription will be cancelled
              </li>
            </ul>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="min-h-[48px] flex-1 rounded-lg border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] sm:min-h-0 sm:py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="min-h-[48px] flex-1 rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50 sm:min-h-0 sm:py-2.5"
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

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="min-h-screen pt-14 pb-20 lg:ml-60 lg:pt-0 lg:pb-0">
          <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center lg:min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          </div>
        </main>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
