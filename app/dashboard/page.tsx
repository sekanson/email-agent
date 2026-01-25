"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import OnboardingModal from "@/components/OnboardingModal";
import {
  Mail,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileText,
  Tag,
  RefreshCw,
  Power,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Brain,
  GitBranch,
  User,
} from "lucide-react";

interface ProcessedEmail {
  id: string;
  gmail_id: string;
  subject: string;
  from: string;
  category: number;
  draft_id: string | null;
  processed_at: string;
  classification_reasoning?: string;
  classification_confidence?: number;
  is_thread?: boolean;
  sender_known?: boolean;
}

interface Metrics {
  totalProcessed: number;
  toRespond: number;
  draftsCreated: number;
  other: number;
  byCategory: Record<number, number>;
  totalAll: number;
}

interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
  required?: boolean;
  description: string;
  rules?: string;
  drafts?: boolean;
  order: number;
}

const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": {
    name: "1: Respond",
    color: "#F87171",
    enabled: true,
    required: true,
    description: "Requires your reply or action",
    rules: "",
    drafts: true,
    order: 1,
  },
  "2": {
    name: "2: Update",
    color: "#FB923C",
    enabled: true,
    description: "Worth knowing, no response required",
    rules: "",
    drafts: false,
    order: 2,
  },
  "3": {
    name: "3: Comment",
    color: "#22D3EE",
    enabled: true,
    description: "Mentions from docs, threads & chats",
    rules: "",
    drafts: false,
    order: 3,
  },
  "4": {
    name: "4: Notification",
    color: "#4ADE80",
    enabled: true,
    description: "Automated alerts & confirmations",
    rules: "",
    drafts: false,
    order: 4,
  },
  "5": {
    name: "5: Calendar",
    color: "#A855F7",
    enabled: true,
    description: "Meetings, invites & calendar events",
    rules: "",
    drafts: false,
    order: 5,
  },
  "6": {
    name: "6: Pending",
    color: "#60A5FA",
    enabled: true,
    description: "Waiting on someone else's response",
    rules: "",
    drafts: false,
    order: 6,
  },
  "7": {
    name: "7: Complete",
    color: "#2DD4BF",
    enabled: true,
    description: "Resolved or finished conversations",
    rules: "",
    drafts: false,
    order: 7,
  },
  "8": {
    name: "8: Marketing/Spam",
    color: "#F472B6",
    enabled: true,
    description: "Newsletters, sales & promotional",
    rules: "",
    drafts: false,
    order: 8,
  },
};

const DATE_RANGES = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

export default function Dashboard() {
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalProcessed: 0,
    toRespond: 0,
    draftsCreated: 0,
    other: 0,
    byCategory: {},
    totalAll: 0,
  });
  const [categories, setCategories] =
    useState<Record<string, CategoryConfig>>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [labelsCreated, setLabelsCreated] = useState(false);
  const [processResult, setProcessResult] = useState<{
    processed: number;
    skipped: number;
  } | null>(null);
  const [autoPolling, setAutoPolling] = useState(false);
  const [pollInterval, setPollInterval] = useState(120);
  const [lastPolled, setLastPolled] = useState<Date | null>(null);
  const [nextPollIn, setNextPollIn] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const [displayLimit, setDisplayLimit] = useState(25);
  const [upgrading, setUpgrading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("trial");
  const [draftLimitReached, setDraftLimitReached] = useState(false);
  const [userDraftCount, setUserDraftCount] = useState(0);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userName, setUserName] = useState("");

  const toggleEmailExpanded = (emailId: string) => {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const userEmail =
    typeof window !== "undefined"
      ? localStorage.getItem("userEmail") || ""
      : "";

  useEffect(() => {
    if (userEmail) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail && !loading) {
      fetchEmails();
    }
  }, [dateRange, categoryFilter, userEmail]);

  useEffect(() => {
    if (!autoPolling || !labelsCreated || processing) return;

    const pollEmails = async () => {
      if (processing) return;
      await handleProcessEmails(true);
      setLastPolled(new Date());
    };

    pollEmails();

    const intervalId = setInterval(pollEmails, pollInterval * 1000);

    const countdownId = setInterval(() => {
      if (lastPolled) {
        const elapsed = Math.floor((Date.now() - lastPolled.getTime()) / 1000);
        const remaining = Math.max(0, pollInterval - elapsed);
        setNextPollIn(remaining);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      clearInterval(countdownId);
    };
  }, [autoPolling, labelsCreated, pollInterval]);

  async function fetchData() {
    try {
      const settingsRes = await fetch(`/api/settings?userEmail=${userEmail}`);
      const settingsData = await settingsRes.json();

      const userLabelsCreated = settingsData.user?.labels_created || false;
      setLabelsCreated(userLabelsCreated);

      // Set user name for onboarding
      if (settingsData.user?.name) {
        setUserName(settingsData.user.name);
      }

      // Check if onboarding should be shown (new user who hasn't completed onboarding)
      const onboardingCompleted = settingsData.user?.onboarding_completed || false;
      if (!onboardingCompleted && !userLabelsCreated) {
        setShowOnboarding(true);
      }

      // Get subscription status and draft count
      if (settingsData.user?.subscription_status) {
        setSubscriptionStatus(settingsData.user.subscription_status);
      }
      if (settingsData.user?.drafts_created_count !== undefined) {
        setUserDraftCount(settingsData.user.drafts_created_count);
        // Check if limit reached for non-pro users
        if (settingsData.user.subscription_status !== "active" &&
            settingsData.user.drafts_created_count >= 10) {
          setDraftLimitReached(true);
        }
      }

      if (settingsData.settings?.categories) {
        setCategories(settingsData.settings.categories);
      }

      const storedAutoPoll = localStorage.getItem("autoPolling");
      const storedInterval = localStorage.getItem("pollInterval");

      if (storedAutoPoll !== null) {
        setAutoPolling(storedAutoPoll === "true");
      } else if (settingsData.settings?.auto_poll_enabled !== undefined) {
        setAutoPolling(settingsData.settings.auto_poll_enabled);
      } else if (userLabelsCreated) {
        setAutoPolling(true);
      }

      if (storedInterval) {
        setPollInterval(parseInt(storedInterval));
      } else if (settingsData.settings?.auto_poll_interval) {
        setPollInterval(settingsData.settings.auto_poll_interval);
      }

      await fetchEmails();
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEmails() {
    try {
      let url = `/api/emails?userEmail=${userEmail}&dateRange=${dateRange}&limit=100`;
      if (categoryFilter !== null) {
        url += `&category=${categoryFilter}`;
      }
      const emailsRes = await fetch(url);
      if (emailsRes.ok) {
        const emailsData = await emailsRes.json();
        setEmails(emailsData.emails || []);
        if (emailsData.metrics) {
          setMetrics(emailsData.metrics);
        }
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
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
      } else {
        console.error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Failed to start checkout:", error);
    } finally {
      setUpgrading(false);
    }
  }

  async function handleResetMetrics() {
    const confirmed = window.confirm(
      "This will clear all processed email history and reset your metrics to zero. Your Gmail labels will not be affected. Continue?"
    );

    if (confirmed) {
      try {
        const res = await fetch("/api/emails", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail }),
        });

        if (res.ok) {
          setEmails([]);
          setMetrics({
            totalProcessed: 0,
            toRespond: 0,
            draftsCreated: 0,
            other: 0,
            byCategory: {},
            totalAll: 0,
          });
          setDisplayLimit(25);
        } else {
          alert("Failed to reset metrics");
        }
      } catch (error) {
        console.error("Failed to reset metrics:", error);
        alert("Failed to reset metrics");
      }
    }
  }

  function handleOnboardingComplete() {
    setShowOnboarding(false);
    // Refresh data to get updated labels_created status
    fetchData();
  }

  function handleOnboardingSkip() {
    setShowOnboarding(false);
    // Mark onboarding as completed even if skipped
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userEmail,
        onboarding_completed: true,
      }),
    }).catch(console.error);
  }

  async function toggleAutoPolling() {
    const newValue = !autoPolling;
    setAutoPolling(newValue);

    localStorage.setItem("autoPolling", String(newValue));
    localStorage.setItem("pollInterval", String(pollInterval));

    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail,
          settings: {
            auto_poll_enabled: newValue,
            auto_poll_interval: pollInterval,
          },
        }),
      });
    } catch (error) {
      console.error("Failed to save auto-poll setting:", error);
    }
  }

  async function handleProcessEmails(silent: boolean = false) {
    setProcessing(true);
    if (!silent) setProcessResult(null);

    try {
      const res = await fetch("/api/process-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, maxEmails: 20 }),
      });

      const data = await res.json();

      if (res.ok) {
        if (!silent || data.processed > 0) {
          setProcessResult({
            processed: data.processed,
            skipped: data.skipped,
          });
        }
        // Update draft limit status from response
        if (data.draftLimitReached !== undefined) {
          setDraftLimitReached(data.draftLimitReached);
        }
        if (data.userDraftCount !== undefined) {
          setUserDraftCount(data.userDraftCount);
        }
        await fetchEmails();
        setLastPolled(new Date());
      } else if (!silent) {
        alert(data.error || "Failed to process emails");
      }
    } catch (error) {
      console.error("Failed to process emails:", error);
      if (!silent) alert("Failed to process emails");
    } finally {
      setProcessing(false);
    }
  }

  function getCategoryBadge(category: number) {
    const config = categories[category.toString()] || {
      name: `Category ${category}`,
      color: "#6b7280",
    };
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium sm:gap-2 sm:px-3 sm:py-1.5"
        style={{
          backgroundColor: `${config.color}15`,
          color: config.color,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: config.color }}
        />
        <span className="hidden sm:inline">{config.name}</span>
        <span className="sm:hidden">{config.name.split(":")[0]}</span>
      </span>
    );
  }

  // Emails are now filtered server-side via API
  const displayedEmails = emails.slice(0, displayLimit);
  const hasMore = emails.length > displayLimit;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="min-h-screen pt-14 pb-20 lg:ml-60 lg:pt-0 lg:pb-0">
          <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center lg:min-h-screen">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl" />
                <Loader2 className="relative h-8 w-8 animate-spin text-blue-500" />
              </div>
              <p className="text-sm text-[var(--text-muted)]">Loading dashboard...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="min-h-screen pt-14 pb-20 lg:ml-60 lg:pt-0 lg:pb-0">
          <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center lg:min-h-screen">
            <div className="text-center px-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-card)]">
                <Mail className="h-8 w-8 text-[var(--text-muted)]" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Not signed in
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Please sign in to access the dashboard.
              </p>
              <a
                href="/"
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent-hover)] hover:shadow-md hover:shadow-blue-500/15"
              >
                Go to Home
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          userEmail={userEmail}
          userName={userName}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      <main className="min-h-screen pt-14 pb-20 lg:ml-60 lg:pt-0 lg:pb-0 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
          <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
                  Dashboard
                </h1>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">
                  {dateRange === "all"
                    ? "Overview of your email activity"
                    : `Email activity ${
                        dateRange === "today"
                          ? "today"
                          : dateRange === "week"
                          ? "this week"
                          : "this month"
                      }`}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Date Range Filter - Scrollable on mobile */}
                <div className="-mx-4 flex-1 overflow-x-auto px-4 sm:mx-0 sm:flex-none sm:overflow-visible sm:px-0">
                  <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-1">
                    {DATE_RANGES.map((range) => (
                      <button
                        key={range.value}
                        onClick={() => setDateRange(range.value as typeof dateRange)}
                        className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-200 sm:px-3 sm:text-sm ${
                          dateRange === range.value
                            ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upgrade Button - show if not on active pro */}
                {subscriptionStatus !== "active" && (
                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-2 text-xs font-medium text-white transition-all hover:from-blue-600 hover:to-purple-600 hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 sm:px-4 sm:text-sm"
                  >
                    {upgrading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Upgrade</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {/* Agent Status Card */}
          {!labelsCreated ? (
            <div className="glass-card mb-6 border-amber-500/30 bg-amber-500/5 p-4 sm:mb-8 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 sm:h-12 sm:w-12">
                    <Tag className="h-5 w-5 text-amber-400 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[var(--text-primary)]">
                      Setup Required
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)] sm:text-sm">
                      Create Gmail labels before activating the email agent
                    </p>
                  </div>
                </div>
                <a
                  href="/categorize"
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-amber-600 hover:shadow-md hover:shadow-amber-500/15"
                >
                  <Tag className="h-4 w-4" />
                  Setup Labels
                </a>
              </div>
            </div>
          ) : (
            <div
              className={`glass-card mb-6 p-4 transition-all sm:mb-8 sm:p-6 ${
                autoPolling
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : ""
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <button
                    onClick={toggleAutoPolling}
                    className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all sm:h-12 sm:w-12 ${
                      autoPolling
                        ? "bg-emerald-500 shadow-md shadow-emerald-500/15 hover:bg-emerald-600"
                        : "bg-[var(--bg-elevated)] hover:bg-[var(--border)]"
                    }`}
                  >
                    <Power
                      className={`h-4 w-4 transition-transform group-hover:scale-110 sm:h-5 sm:w-5 ${
                        autoPolling ? "text-white" : "text-[var(--text-muted)]"
                      }`}
                    />
                  </button>
                  <div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <h2 className="font-semibold text-[var(--text-primary)]">
                        Email Agent
                      </h2>
                      {autoPolling ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 sm:px-2.5">
                          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-elevated)] px-2 py-1 text-xs font-medium text-[var(--text-muted)] sm:px-2.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]" />
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)] sm:text-sm">
                      {autoPolling
                        ? "Monitoring Gmail, applying labels, and drafting responses"
                        : "Click the power button to start monitoring your inbox"}
                    </p>
                  </div>
                </div>

                {autoPolling && (
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] sm:text-sm">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                        <span className="hidden sm:inline">Checking every</span>
                        <select
                          value={pollInterval}
                          onChange={(e) => {
                            setPollInterval(Number(e.target.value));
                            localStorage.setItem("pollInterval", e.target.value);
                          }}
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none sm:text-sm"
                        >
                          <option value={60}>1 min</option>
                          <option value={120}>2 min</option>
                          <option value={180}>3 min</option>
                          <option value={300}>5 min</option>
                        </select>
                      </div>
                      {nextPollIn !== null && (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Next check in {nextPollIn}s
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Draft Limit Warning - Reached */}
          {draftLimitReached && subscriptionStatus !== "active" && (
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
                <div>
                  <span className="text-sm font-medium text-red-300">
                    Draft limit reached
                  </span>
                  <p className="text-xs text-red-400/80">
                    You've used all 10 free drafts. Upgrade to Pro for unlimited AI-generated drafts.
                  </p>
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-600 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade
              </button>
            </div>
          )}

          {/* Draft Limit Warning - Approaching (>7 but not reached) */}
          {!draftLimitReached && userDraftCount > 7 && subscriptionStatus !== "active" && (
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
                <div>
                  <span className="text-sm font-medium text-amber-300">
                    Approaching draft limit
                  </span>
                  <p className="text-xs text-amber-400/70">
                    You've used {userDraftCount} of 10 free drafts. Upgrade for unlimited.
                  </p>
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition-all hover:bg-amber-500/20 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade
              </button>
            </div>
          )}

          {processResult && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-400" />
              <span className="text-sm text-emerald-300">
                Processed {processResult.processed} new emails
                {processResult.skipped > 0 &&
                  ` (${processResult.skipped} already processed)`}
              </span>
            </div>
          )}

          {/* Stats Grid - 1 column on mobile, 2 on sm, 4 on lg */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:mb-8">
            <StatsCard
              title="Total Processed"
              value={metrics.totalProcessed}
              icon={<Mail className="h-5 w-5" />}
              color="blue"
            />
            <StatsCard
              title="To Respond"
              value={metrics.toRespond}
              icon={<AlertTriangle className="h-5 w-5" />}
              color="red"
            />
            <StatsCard
              title="Drafts Created"
              value={metrics.draftsCreated}
              icon={<FileText className="h-5 w-5" />}
              color="green"
            />
            <StatsCard
              title="Other"
              value={metrics.other}
              icon={<CheckCircle className="h-5 w-5" />}
              color="cyan"
            />
          </div>

          {/* Category Breakdown */}
          <div className="glass-card mb-6 p-4 sm:mb-8 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] sm:text-sm">
                By Category
              </h2>
              {categoryFilter !== null && (
                <button
                  onClick={() => setCategoryFilter(null)}
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
            {/* 2 columns on mobile, 4 on sm+ */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {Object.entries(categories).map(([num, config]) => {
                const categoryNum = parseInt(num);
                const isSelected = categoryFilter === categoryNum;
                const count = metrics.byCategory[categoryNum] || 0;
                return (
                  <button
                    key={num}
                    onClick={() => setCategoryFilter(isSelected ? null : categoryNum)}
                    className={`group flex items-center justify-between rounded-xl border p-2 transition-all text-left sm:p-3 ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/20"
                        : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <div
                        className={`h-2 w-2 rounded-full transition-transform sm:h-2.5 sm:w-2.5 ${isSelected ? "scale-125" : ""}`}
                        style={{ backgroundColor: config.color }}
                      />
                      <span className={`text-xs sm:text-sm ${
                        isSelected
                          ? "text-[var(--accent)] font-medium"
                          : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                      }`}>
                        <span className="sm:hidden">{config.name.split(":")[0]}</span>
                        <span className="hidden sm:inline">{config.name}</span>
                      </span>
                    </div>
                    <span className={`text-xs font-semibold sm:text-sm ${
                      isSelected ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Emails */}
          <div className="glass-card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] sm:text-sm">
                  Recent Emails
                </h2>
                {categoryFilter !== null && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium sm:gap-1.5 sm:px-2.5 sm:py-1"
                    style={{
                      backgroundColor: `${categories[categoryFilter.toString()]?.color}15`,
                      color: categories[categoryFilter.toString()]?.color,
                    }}
                  >
                    <span className="truncate max-w-[100px] sm:max-w-none">{categories[categoryFilter.toString()]?.name}</span>
                    <button
                      onClick={() => setCategoryFilter(null)}
                      className="ml-1 hover:opacity-70"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              {metrics.totalAll > 0 && (
                <button
                  onClick={handleResetMetrics}
                  className="flex items-center gap-1.5 self-start text-xs text-[var(--text-muted)] transition-colors hover:text-red-400"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset metrics
                </button>
              )}
            </div>

            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-elevated)] sm:h-14 sm:w-14">
                  <Mail className="h-5 w-5 text-[var(--text-muted)] sm:h-6 sm:w-6" />
                </div>
                {categoryFilter !== null && emails.length > 0 ? (
                  <>
                    <p className="text-sm text-[var(--text-secondary)]">
                      No emails in this category
                    </p>
                    <button
                      onClick={() => setCategoryFilter(null)}
                      className="mt-2 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
                    >
                      Clear filter to see all emails
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[var(--text-secondary)]">
                      No emails processed yet
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {labelsCreated
                        ? "Turn on the Email Agent to start processing"
                        : 'Click "Setup Labels" to get started'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="divide-y divide-[var(--border)]">
                  {displayedEmails.map((email) => {
                    const isExpanded = expandedEmails.has(email.id);
                    return (
                      <div key={email.id}>
                        <button
                          onClick={() => toggleEmailExpanded(email.id)}
                          className="group flex w-full items-start gap-2 px-4 py-3 text-left transition-all hover:bg-[var(--bg-card-hover)] sm:items-center sm:gap-3 sm:px-6 sm:py-4"
                        >
                          <div className={`mt-1 transition-transform sm:mt-0 ${isExpanded ? "rotate-90" : ""}`}>
                            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            {/* Mobile layout */}
                            <div className="sm:hidden">
                              <p className="truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                                {email.subject || "(No subject)"}
                              </p>
                              <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                                {email.from}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                {getCategoryBadge(email.category)}
                                {email.draft_id && (
                                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                                    <FileText className="h-3 w-3" />
                                    Draft
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Desktop layout */}
                            <div className="hidden sm:block">
                              <div className="flex items-center gap-3">
                                <p className="truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                                  {email.subject || "(No subject)"}
                                </p>
                                {email.draft_id && (
                                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                                    <FileText className="h-3 w-3" />
                                    Draft
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                                {email.from}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                            <span className="hidden sm:inline">{getCategoryBadge(email.category)}</span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {new Date(email.processed_at).toLocaleDateString()}
                            </span>
                          </div>
                        </button>

                        {/* Expanded Classification Details */}
                        {isExpanded && (
                          <div className="border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 sm:px-6 sm:py-4">
                            <div className="ml-6 space-y-3 sm:ml-7">
                              {/* AI Reasoning */}
                              {email.classification_reasoning ? (
                                <div className="flex gap-2 sm:gap-3">
                                  <Brain className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-400" />
                                  <div>
                                    <p className="text-xs font-medium text-[var(--text-secondary)]">AI Classification Reasoning</p>
                                    <p className="mt-1 text-sm text-[var(--text-primary)]">
                                      {email.classification_reasoning}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2 sm:gap-3">
                                  <Brain className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
                                  <p className="text-sm text-[var(--text-muted)] italic">
                                    No classification reasoning available (processed before enhancement)
                                  </p>
                                </div>
                              )}

                              {/* Metadata badges */}
                              <div className="flex flex-wrap items-center gap-2">
                                {email.classification_confidence !== undefined && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-secondary)] sm:px-2.5">
                                    Confidence: {Math.round(email.classification_confidence * 100)}%
                                  </span>
                                )}
                                {email.is_thread && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-400 sm:px-2.5">
                                    <GitBranch className="h-3 w-3" />
                                    Thread
                                  </span>
                                )}
                                {email.sender_known && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400 sm:px-2.5">
                                    <User className="h-3 w-3" />
                                    Known Sender
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="border-t border-[var(--border)] p-4 text-center">
                    <button
                      onClick={() => setDisplayLimit((prev) => Math.min(prev + 25, 100))}
                      className="inline-flex min-h-[44px] items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Load more ({Math.min(emails.length - displayLimit, 25)} remaining)
                    </button>
                  </div>
                )}

                {displayLimit >= 100 && emails.length >= 100 && (
                  <div className="border-t border-[var(--border)] p-4 text-center">
                    <p className="text-xs text-[var(--text-muted)]">
                      Showing last 100 emails
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
