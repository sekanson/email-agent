"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import OnboardingModal from "@/components/OnboardingModal";
import ConfirmModal from "@/components/ConfirmModal";
import Link from "next/link";
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
  Clock,
  Send,
  ArrowRight,
  Inbox,
  Filter,
  X,
  Calendar,
  Trash2,
} from "lucide-react";
import { DEFAULT_CATEGORIES, getCategoryColor, getCategoryName, type CategoryConfig } from "@/lib/categories";
import { useUpgradePrompt } from "@/lib/use-upgrade-prompt";
import { type UserSettings } from "@/lib/settings-merge";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useRequireAuth } from "@/lib/useAuth";

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
  snippet?: string;
}

interface Metrics {
  totalProcessed: number;
  toRespond: number;
  draftsCreated: number;
  other: number;
  byCategory: Record<number, number>;
  totalAll: number;
}

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
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: "danger" | "warning" | "default";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "default",
    onConfirm: () => {},
  });
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
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // Upgrade prompt functionality
  const {
    currentPrompt,
    hasUpgrades,
    handleUpgradeAction,
  } = useUpgradePrompt(userSettings);

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

  const { userEmail: authEmail, isLoading: authLoading } = useRequireAuth();
  const userEmail = authEmail || "";

  useEffect(() => {
    if (authLoading) return;
    if (userEmail) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [userEmail, authLoading]);

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

      if (settingsData.user?.name) {
        setUserName(settingsData.user.name);
      }

      const onboardingCompleted = settingsData.user?.onboarding_completed || false;
      if (!onboardingCompleted && !userLabelsCreated) {
        setShowOnboarding(true);
      }

      if (settingsData.user?.subscription_status) {
        setSubscriptionStatus(settingsData.user.subscription_status);
      }
      if (settingsData.user?.drafts_created_count !== undefined) {
        setUserDraftCount(settingsData.user.drafts_created_count);
        if (settingsData.user.subscription_status !== "active" &&
            settingsData.user.drafts_created_count >= 10) {
          setDraftLimitReached(true);
        }
      }

      if (settingsData.settings?.categories) {
        setCategories(settingsData.settings.categories);
      }

      // Store full user settings for upgrade prompt functionality
      if (settingsData.settings) {
        setUserSettings(settingsData.settings);
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
      }
    } catch (error) {
      console.error("Failed to start checkout:", error);
    } finally {
      setUpgrading(false);
    }
  }

  function handleResetMetrics() {
    setConfirmModal({
      isOpen: true,
      title: "Reset Email Metrics?",
      message: "This will clear all processed email history and reset your metrics to zero. Your Gmail labels will not be affected.",
      confirmText: "Reset Metrics",
      variant: "warning",
      onConfirm: executeResetMetrics,
    });
  }

  async function executeResetMetrics() {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
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
      }
    } catch (error) {
      console.error("Failed to reset metrics:", error);
    }
  }

  function handleOnboardingComplete() {
    setShowOnboarding(false);
    fetchData();
  }

  function handleOnboardingSkip() {
    setShowOnboarding(false);
    fetch("/api/user/onboarding-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  // Calculate actionable metrics
  const needsAttention = (metrics.byCategory[1] || 0) + (metrics.byCategory[6] || 0);
  const calendarInvites = metrics.byCategory[5] || 0; // Category 5 is Meeting/Calendar
  const spamCleared = metrics.byCategory[8] || 0; // Category 8 is Marketing/Spam
  
  // Weekly time saved calculation - variable time based on email types
  // More realistic: spam=30s, notifications=45s, FYI=1min, responses=3min, meetings=2min
  const calculateWeeklyTimeSaved = () => {
    const timePerCategory: Record<number, number> = {
      1: 3,    // To Respond - 3 min (reading + drafting)
      2: 1,    // FYI - 1 min
      3: 1.5,  // Comment - 1.5 min
      4: 0.75, // Notification - 45 sec
      5: 2,    // Meeting - 2 min
      6: 1.5,  // Awaiting Reply - 1.5 min
      7: 0.5,  // Actioned - 30 sec
      8: 0.5,  // Marketing/Spam - 30 sec
    };
    
    let totalMinutes = 0;
    Object.entries(metrics.byCategory).forEach(([cat, count]) => {
      const catNum = parseInt(cat);
      const timePerEmail = timePerCategory[catNum] || 1;
      totalMinutes += count * timePerEmail;
    });
    
    // Add 20% efficiency bonus for batch processing
    totalMinutes = Math.round(totalMinutes * 1.2);
    
    return totalMinutes;
  };
  
  const weeklyTimeSavedMinutes = calculateWeeklyTimeSaved();
  const timeSavedDisplay = weeklyTimeSavedMinutes >= 60 
    ? `${Math.floor(weeklyTimeSavedMinutes / 60)}h ${weeklyTimeSavedMinutes % 60}m`
    : `${weeklyTimeSavedMinutes}m`;

  // Use shared category helpers
  const getCatColor = (category: number) => getCategoryColor(categories, category);
  const getCatName = (category: number) => getCategoryName(categories, category);

  const displayedEmails = emails.slice(0, displayLimit);
  const hasMore = emails.length > displayLimit;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="min-h-screen pt-12 pb-20 lg:ml-60 lg:pt-0 lg:pb-0">
          <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center lg:min-h-screen">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
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
        <main className="min-h-screen pt-12 pb-20 lg:ml-60 lg:pt-0 lg:pb-0">
          <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center lg:min-h-screen">
            <div className="text-center px-4">
              <Mail className="mx-auto h-12 w-12 text-[var(--text-muted)]" />
              <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
                Not signed in
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Please sign in to access the dashboard.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      {showOnboarding && (
        <OnboardingModal
          userEmail={userEmail}
          userName={userName}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* Upgrade Prompt - Only show non-category upgrades here (categories show in /categorize) */}
      {currentPrompt && currentPrompt.schema !== 'categories' && (
        <UpgradePrompt
          schema={currentPrompt.schema}
          fromVersion={currentPrompt.fromVersion}
          toVersion={currentPrompt.toVersion}
          userEmail={userEmail}
          onUpgrade={() => handleUpgradeAction(userEmail, 'upgrade')}
          onDismiss={() => handleUpgradeAction(userEmail, 'dismiss')}
          onKeepCurrent={() => handleUpgradeAction(userEmail, 'keep')}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      <main className="min-h-screen pt-12 pb-20 lg:ml-60 lg:pt-0 lg:pb-0 overflow-auto">
        {/* Compact Header with Agent Status */}
        <div className="border-b border-[var(--border)] bg-[var(--bg-primary)]">
          <div className="px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: Title + Agent Status */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div>
                  <h1 className="text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
                    Dashboard
                  </h1>
                </div>

                {/* Agent Status with Toggle */}
                {labelsCreated && (
                  <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1 sm:gap-3 sm:px-3 sm:py-1.5">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className={`h-2 w-2 rounded-full ${autoPolling ? "bg-emerald-400 animate-pulse" : "bg-[var(--text-muted)]"}`} />
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {autoPolling ? "Active" : "Paused"}
                      </span>
                      {autoPolling && nextPollIn !== null && (
                        <span className="hidden text-xs text-[var(--text-muted)] sm:inline">• {nextPollIn}s</span>
                      )}
                    </div>
                    {/* Toggle Switch */}
                    <button
                      onClick={toggleAutoPolling}
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        autoPolling ? "bg-emerald-500" : "bg-[var(--bg-elevated)]"
                      }`}
                      aria-label={autoPolling ? "Pause agent" : "Start agent"}
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          autoPolling ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Controls */}
              <div className="flex items-center gap-2">
                {/* Date Range Filter */}
                <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-0.5">
                  {DATE_RANGES.map((range) => (
                    <button
                      key={range.value}
                      onClick={() => setDateRange(range.value as typeof dateRange)}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-all sm:px-3 ${
                        dateRange === range.value
                          ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      <span className="hidden sm:inline">{range.label}</span>
                      <span className="sm:hidden">{range.label.replace("This ", "")}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {/* Setup Required Banner */}
          {!labelsCreated && (
            <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
                    <Tag className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[var(--text-primary)]">
                      Setup Required
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Create Gmail labels to activate the email agent
                    </p>
                  </div>
                </div>
                <Link
                  href="/categorize"
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-amber-600"
                >
                  <Tag className="h-4 w-4" />
                  Setup Labels
                </Link>
              </div>
            </div>
          )}

          {/* Draft Limit Warning */}
          {draftLimitReached && subscriptionStatus !== "active" && (
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-300">Draft limit reached</p>
                  <p className="text-xs text-red-400/80">Upgrade to Pro for unlimited AI-generated drafts</p>
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade
              </button>
            </div>
          )}

          {/* Process Result Toast */}
          {processResult && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <span className="text-sm text-emerald-300">
                Processed {processResult.processed} new emails
                {processResult.skipped > 0 && ` (${processResult.skipped} already processed)`}
              </span>
            </div>
          )}

          {/* Action Cards Row */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {/* Needs Attention */}
            <button
              onClick={() => setCategoryFilter(categoryFilter === 1 ? null : 1)}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all hover:shadow-lg sm:p-5 ${
                categoryFilter === 1
                  ? "border-red-500/50 bg-red-500/10"
                  : "border-[var(--border)] bg-[var(--bg-card)] hover:border-red-500/30"
              }`}
            >
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-red-500/10 blur-2xl transition-all group-hover:bg-red-500/20" />
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 sm:h-11 sm:w-11">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
                  {needsAttention}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">Needs Attention</p>
              </div>
            </button>

            {/* Calendar Invites */}
            <button
              onClick={() => setCategoryFilter(categoryFilter === 5 ? null : 5)}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all hover:shadow-lg sm:p-5 ${
                categoryFilter === 5
                  ? "border-purple-500/50 bg-purple-500/10"
                  : "border-[var(--border)] bg-[var(--bg-card)] hover:border-purple-500/30"
              }`}
            >
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-purple-500/10 blur-2xl transition-all group-hover:bg-purple-500/20" />
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 sm:h-11 sm:w-11">
                  <Calendar className="h-5 w-5 text-purple-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
                  {calendarInvites}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">Calendar Invites</p>
              </div>
            </button>

            {/* Spam Cleared */}
            <button
              onClick={() => setCategoryFilter(categoryFilter === 8 ? null : 8)}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all hover:shadow-lg sm:p-5 ${
                categoryFilter === 8
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-[var(--border)] bg-[var(--bg-card)] hover:border-emerald-500/30"
              }`}
            >
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:bg-emerald-500/20" />
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 sm:h-11 sm:w-11">
                  <Trash2 className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
                  {spamCleared}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">Spam Cleared</p>
              </div>
            </button>

            {/* Time Saved Weekly */}
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-amber-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 sm:h-11 sm:w-11">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
                  {timeSavedDisplay}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">Time Saved Weekly</p>
              </div>
            </div>
          </div>

          {/* Email List Section */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            {/* List Header with Category Filters */}
            <div className="border-b border-[var(--border)] p-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Recent Emails
                  </h2>
                  {categoryFilter !== null && (
                    <button
                      onClick={() => setCategoryFilter(null)}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: `${getCatColor(categoryFilter)}15`,
                        color: getCatColor(categoryFilter),
                      }}
                    >
                      {getCatName(categoryFilter)}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Category Filter Dropdown */}
                  <div className="relative">
                    <button
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--border)]"
                      onClick={() => {
                        const dropdown = document.getElementById('category-dropdown');
                        dropdown?.classList.toggle('hidden');
                      }}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      Filter
                    </button>
                    <div
                      id="category-dropdown"
                      className="hidden absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-xl"
                    >
                      {Object.entries(categories).map(([num, config]) => (
                        <button
                          key={num}
                          onClick={() => {
                            setCategoryFilter(categoryFilter === parseInt(num) ? null : parseInt(num));
                            document.getElementById('category-dropdown')?.classList.add('hidden');
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            categoryFilter === parseInt(num)
                              ? "bg-[var(--bg-elevated)]"
                              : "hover:bg-[var(--bg-elevated)]"
                          }`}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: config.color }}
                          />
                          <span className="text-[var(--text-secondary)]">{config.name}</span>
                          <span className="ml-auto text-xs text-[var(--text-muted)]">
                            {metrics.byCategory[parseInt(num)] || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {metrics.totalAll > 0 && (
                    <button
                      onClick={handleResetMetrics}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-red-400"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Email List */}
            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-elevated)]">
                  <Mail className="h-6 w-6 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {categoryFilter !== null ? "No emails in this category" : "No emails processed yet"}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {labelsCreated
                    ? "Turn on the agent to start processing"
                    : 'Click "Setup Labels" to get started'}
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[var(--border)]">
                  {displayedEmails.map((email) => {
                    const isExpanded = expandedEmails.has(email.id);
                    const categoryColor = getCatColor(email.category);
                    
                    return (
                      <div key={email.id} className="relative">
                        {/* Priority indicator bar */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1"
                          style={{ backgroundColor: email.category === 1 ? categoryColor : 'transparent' }}
                        />
                        
                        <button
                          onClick={() => toggleEmailExpanded(email.id)}
                          className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-all hover:bg-[var(--bg-elevated)] sm:items-center sm:px-6 sm:py-4"
                        >
                          <ChevronRight className={`mt-0.5 h-4 w-4 text-[var(--text-muted)] transition-transform sm:mt-0 ${isExpanded ? "rotate-90" : ""}`} />
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2 sm:items-center">
                              <p className="truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                                {email.subject || "(No subject)"}
                              </p>
                              {email.draft_id && (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                                  <FileText className="h-3 w-3" />
                                  <span className="hidden sm:inline">Draft</span>
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                              {email.from}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span
                              className="hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex"
                              style={{
                                backgroundColor: `${categoryColor}15`,
                                color: categoryColor,
                              }}
                            >
                              {getCatName(email.category)}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {new Date(email.processed_at).toLocaleDateString()}
                            </span>
                          </div>
                        </button>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-4 sm:px-6">
                            <div className="ml-7 space-y-3">
                              {/* Mobile category badge */}
                              <div className="sm:hidden">
                                <span
                                  className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                                  style={{
                                    backgroundColor: `${categoryColor}15`,
                                    color: categoryColor,
                                  }}
                                >
                                  {getCatName(email.category)}
                                </span>
                              </div>
                              
                              {email.classification_reasoning ? (
                                <div className="flex gap-3">
                                  <Brain className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-400" />
                                  <div>
                                    <p className="text-xs font-medium text-[var(--text-secondary)]">AI Reasoning</p>
                                    <p className="mt-1 text-sm text-[var(--text-primary)]">
                                      {email.classification_reasoning}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-[var(--text-muted)] italic">
                                  No AI reasoning available
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2">
                                {email.classification_confidence !== undefined && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-card)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                                    Confidence: {Math.round(email.classification_confidence * 100)}%
                                  </span>
                                )}
                                {email.is_thread && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400">
                                    <GitBranch className="h-3 w-3" />
                                    Thread
                                  </span>
                                )}
                                {email.sender_known && (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400">
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

                {hasMore && (
                  <div className="border-t border-[var(--border)] p-4 text-center">
                    <button
                      onClick={() => setDisplayLimit((prev) => Math.min(prev + 25, 100))}
                      className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Load more
                    </button>
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
