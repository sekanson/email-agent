"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
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
} from "lucide-react";

interface ProcessedEmail {
  id: string;
  gmail_id: string;
  subject: string;
  from: string;
  category: number;
  draft_id: string | null;
  processed_at: string;
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
  const [refreshing, setRefreshing] = useState(false);
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
  }, [dateRange, userEmail]);

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
      const emailsRes = await fetch(
        `/api/emails?userEmail=${userEmail}&dateRange=${dateRange}&limit=100`
      );
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

  async function handleRefresh() {
    setRefreshing(true);
    await fetchEmails();
    setRefreshing(false);
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
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
        style={{
          backgroundColor: `${config.color}15`,
          color: config.color,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: config.color }}
        />
        {config.name}
      </span>
    );
  }

  const displayedEmails = emails.slice(0, displayLimit);
  const hasMore = emails.length > displayLimit;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-64 flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl" />
              <Loader2 className="relative h-8 w-8 animate-spin text-blue-500" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">Loading dashboard...</p>
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
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent-hover)] hover:shadow-md hover:shadow-blue-500/15"
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
          <div className="flex items-center justify-between px-8 py-5">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                Dashboard
              </h1>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
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
            <div className="flex items-center gap-3">
              {/* Date Range Filter */}
              <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-1">
                {DATE_RANGES.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => setDateRange(range.value as typeof dateRange)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                      dateRange === range.value
                        ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Agent Status Card */}
          {!labelsCreated ? (
            <div className="glass-card mb-8 border-amber-500/30 bg-amber-500/5 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                    <Tag className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-[var(--text-primary)]">
                      Setup Required
                    </h2>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                      Create Gmail labels before activating the email agent
                    </p>
                  </div>
                </div>
                <a
                  href="/settings"
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-amber-600 hover:shadow-md hover:shadow-amber-500/15"
                >
                  <Tag className="h-4 w-4" />
                  Setup Labels
                </a>
              </div>
            </div>
          ) : (
            <div
              className={`glass-card mb-8 p-6 transition-all ${
                autoPolling
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleAutoPolling}
                    className={`group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
                      autoPolling
                        ? "bg-emerald-500 shadow-md shadow-emerald-500/15 hover:bg-emerald-600"
                        : "bg-[var(--bg-elevated)] hover:bg-[var(--border)]"
                    }`}
                  >
                    <Power
                      className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                        autoPolling ? "text-white" : "text-[var(--text-muted)]"
                      }`}
                    />
                  </button>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-semibold text-[var(--text-primary)]">
                        Email Agent
                      </h2>
                      {autoPolling ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]" />
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                      {autoPolling
                        ? "Monitoring Gmail, applying labels, and drafting responses"
                        : "Click the power button to start monitoring your inbox"}
                    </p>
                  </div>
                </div>

                {autoPolling && (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                        <span>Checking every</span>
                        <select
                          value={pollInterval}
                          onChange={(e) => {
                            setPollInterval(Number(e.target.value));
                            localStorage.setItem("pollInterval", e.target.value);
                          }}
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
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

          {processResult && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <span className="text-sm text-emerald-300">
                Processed {processResult.processed} new emails
                {processResult.skipped > 0 &&
                  ` (${processResult.skipped} already processed)`}
              </span>
            </div>
          )}

          {/* Stats Grid */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="glass-card mb-8 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              By Category
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(categories).map(([num, config]) => (
                <div
                  key={num}
                  className="group flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 transition-all hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                      {config.name}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {metrics.byCategory[parseInt(num)] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Emails */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Recent Emails
              </h2>
              {metrics.totalAll > 0 && (
                <button
                  onClick={handleResetMetrics}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-red-400"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset metrics
                </button>
              )}
            </div>

            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-elevated)]">
                  <Mail className="h-6 w-6 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  No emails processed yet
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {labelsCreated
                    ? "Turn on the Email Agent to start processing"
                    : 'Click "Setup Labels" to get started'}
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[var(--border)]">
                  {displayedEmails.map((email) => (
                    <div
                      key={email.id}
                      className="group flex items-center justify-between px-6 py-4 transition-all hover:bg-[var(--bg-card-hover)]"
                    >
                      <div className="min-w-0 flex-1">
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
                      <div className="ml-4 flex items-center gap-4">
                        {getCategoryBadge(email.category)}
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(email.processed_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="border-t border-[var(--border)] p-4 text-center">
                    <button
                      onClick={() => setDisplayLimit((prev) => Math.min(prev + 25, 100))}
                      className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
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
