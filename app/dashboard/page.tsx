"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import StatsCard from "@/components/StatsCard";
import {
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  Play,
  Loader2,
  FileText,
  Tag,
  RefreshCw,
  Pause,
  Power,
  Settings,
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
  "1": { name: "To Respond", color: "#ef4444", enabled: true },
  "2": { name: "FYI", color: "#f59e0b", enabled: true },
  "3": { name: "Comment", color: "#10b981", enabled: true },
  "4": { name: "Notification", color: "#6366f1", enabled: true },
  "5": { name: "Meeting Update", color: "#8b5cf6", enabled: true },
  "6": { name: "Awaiting Reply", color: "#06b6d4", enabled: true },
  "7": { name: "Actioned", color: "#84cc16", enabled: true },
  "8": { name: "Marketing", color: "#f97316", enabled: true },
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
  const [pollInterval, setPollInterval] = useState(120); // seconds
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

  // Auto-polling effect
  useEffect(() => {
    if (!autoPolling || !labelsCreated || processing) return;

    const pollEmails = async () => {
      if (processing) return;
      await handleProcessEmails(true); // silent mode
      setLastPolled(new Date());
    };

    // Initial poll
    pollEmails();

    // Set up interval
    const intervalId = setInterval(pollEmails, pollInterval * 1000);

    // Countdown timer
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
      // Fetch settings
      const settingsRes = await fetch(`/api/settings?userEmail=${userEmail}`);
      const settingsData = await settingsRes.json();

      const userLabelsCreated = settingsData.user?.labels_created || false;
      setLabelsCreated(userLabelsCreated);

      if (settingsData.settings?.categories) {
        setCategories(settingsData.settings.categories);
      }

      // Load auto-poll from localStorage first (user's most recent action), then DB, then default
      const storedAutoPoll = localStorage.getItem("autoPolling");
      const storedInterval = localStorage.getItem("pollInterval");

      // Prioritize localStorage since it reflects user's most recent toggle action
      if (storedAutoPoll !== null) {
        setAutoPolling(storedAutoPoll === "true");
      } else if (settingsData.settings?.auto_poll_enabled !== undefined) {
        setAutoPolling(settingsData.settings.auto_poll_enabled);
      } else if (userLabelsCreated) {
        // Default to ON if labels are created
        setAutoPolling(true);
      }

      if (storedInterval) {
        setPollInterval(parseInt(storedInterval));
      } else if (settingsData.settings?.auto_poll_interval) {
        setPollInterval(settingsData.settings.auto_poll_interval);
      }

      // Fetch processed emails from Supabase
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

    // Save to localStorage as fallback
    localStorage.setItem("autoPolling", String(newValue));
    localStorage.setItem("pollInterval", String(pollInterval));

    // Try to save to settings (may fail if DB columns don't exist)
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
        // Refresh emails list
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

  // Calculate stats
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
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: config.color }}
      >
        {config.name}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Mail className="mx-auto h-12 w-12 text-gray-400" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              Not signed in
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Please sign in to access the dashboard.
            </p>
            <a
              href="/"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Go to Home
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Overview of your email activity
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/settings"
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <Settings className="h-4 w-4" />
              Settings
            </a>
            {labelsCreated && (
              <button
                onClick={() => handleProcessEmails(false)}
                disabled={processing}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Process Now
              </button>
            )}
          </div>
        </div>

        {/* Agent Status Card */}
        {!labelsCreated ? (
          <div className="mb-8 rounded-lg border-2 border-dashed border-yellow-400 bg-yellow-50 p-6 dark:border-yellow-600 dark:bg-yellow-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-800">
                  <Tag className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Setup Required</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create Gmail labels before activating the email agent
                  </p>
                </div>
              </div>
              <a
                href="/settings"
                className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 font-medium text-white hover:bg-yellow-600"
              >
                <Tag className="h-5 w-5" />
                Setup Labels
              </a>
            </div>
          </div>
        ) : (
          <div className={`mb-8 rounded-lg border-2 p-6 transition-colors ${
            autoPolling
              ? "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-900/20"
              : "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleAutoPolling}
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                    autoPolling
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-gray-300 text-gray-600 hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-300"
                  }`}
                >
                  <Power className="h-6 w-6" />
                </button>
                <div>
                  <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                    Email Agent
                    {autoPolling ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-800 dark:text-green-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        Paused
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {autoPolling
                      ? "Monitoring Gmail, applying labels, and drafting responses"
                      : "Click the power button to start monitoring your inbox"
                    }
                  </p>
                </div>
              </div>

              {autoPolling && (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Checking every
                      <select
                        value={pollInterval}
                        onChange={(e) => {
                          setPollInterval(Number(e.target.value));
                          localStorage.setItem("pollInterval", e.target.value);
                        }}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                      >
                        <option value={60}>1 min</option>
                        <option value={120}>2 min</option>
                        <option value={180}>3 min</option>
                        <option value={300}>5 min</option>
                      </select>
                    </div>
                    {nextPollIn !== null && (
                      <p className="mt-1 text-xs text-gray-500">
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
          <div className="mb-6 rounded-lg bg-green-100 p-4 text-green-800 dark:bg-green-900 dark:text-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span>
                Processed {processResult.processed} new emails - labeled in Gmail
                {processResult.skipped > 0 &&
                  ` (${processResult.skipped} already processed)`}
              </span>
            </div>
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Processed"
            value={stats.total}
            icon={<Mail className="h-5 w-5" />}
            color="blue"
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
            color="yellow"
          />
        </div>

        {/* Category breakdown */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            By Category
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Object.entries(categories).map(([num, config]) => (
              <div
                key={num}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {config.name}
                  </span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {stats.byCategory[parseInt(num)] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent emails */}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 p-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Emails
            </h2>
          </div>

          {emails.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
              No emails processed yet. Click &quot;Process Emails Now&quot; to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {emails.slice(0, 20).map((email) => (
                <div
                  key={email.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900 dark:text-white">
                        {email.subject || "(No subject)"}
                      </p>
                      {email.draft_id && (
                        <span className="flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
                          <FileText className="h-3 w-3" />
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                      {email.from}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-4">
                    {getCategoryBadge(email.category)}
                    <span className="text-xs text-gray-400">
                      {new Date(email.processed_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
