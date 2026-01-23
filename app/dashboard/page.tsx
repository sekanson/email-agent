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

interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
}

const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": { name: "To Respond", color: "#F87171", enabled: true },
  "2": { name: "FYI", color: "#FB923C", enabled: true },
  "3": { name: "Comment", color: "#22D3EE", enabled: true },
  "4": { name: "Notification", color: "#4ADE80", enabled: true },
  "5": { name: "Meeting Update", color: "#A855F7", enabled: true },
  "6": { name: "Awaiting Reply", color: "#60A5FA", enabled: true },
  "7": { name: "Actioned", color: "#2DD4BF", enabled: true },
  "8": { name: "Marketing", color: "#F472B6", enabled: true },
};

export default function Dashboard() {
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
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

      const emailsRes = await fetch(`/api/emails?userEmail=${userEmail}`);
      if (emailsRes.ok) {
        const emailsData = await emailsRes.json();
        setEmails(emailsData.emails || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
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
        await fetchData();
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

  const stats = {
    total: emails.length,
    toRespond: emails.filter((e) => e.category === 1).length,
    draftsCreated: emails.filter((e) => e.draft_id).length,
    byCategory: Object.fromEntries(
      [1, 2, 3, 4, 5, 6, 7, 8].map((num) => [
        num,
        emails.filter((e) => e.category === num).length,
      ])
    ),
  };

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

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl" />
              <Loader2 className="relative h-8 w-8 animate-spin text-violet-500" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">Loading dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
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
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent-hover)] hover:shadow-lg hover:shadow-violet-500/25"
            >
              Go to Home
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-8 py-5">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                Dashboard
              </h1>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                Overview of your email activity
              </p>
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
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/25"
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
                        ? "bg-emerald-500 shadow-lg shadow-emerald-500/30 hover:bg-emerald-600"
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
              value={stats.total}
              icon={<Mail className="h-5 w-5" />}
              color="violet"
            />
            <StatsCard
              title="To Respond"
              value={stats.toRespond}
              icon={<AlertTriangle className="h-5 w-5" />}
              color="red"
            />
            <StatsCard
              title="Drafts Created"
              value={stats.draftsCreated}
              icon={<FileText className="h-5 w-5" />}
              color="green"
            />
            <StatsCard
              title="FYI / Other"
              value={stats.total - stats.toRespond}
              icon={<CheckCircle className="h-5 w-5" />}
              color="blue"
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
                    {stats.byCategory[parseInt(num)] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Emails */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Recent Emails
              </h2>
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
                  Click &quot;Process Now&quot; to get started
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {emails.slice(0, 20).map((email) => (
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
