"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  BarChart3,
  Mail,
  FileText,
  TrendingUp,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface AnalyticsData {
  overview: {
    totalEmails: number;
    monthlyEmails: number;
    monthlyDrafts: number;
    responseRate: number;
  };
  categoryBreakdown: Record<number, number>;
  categories: Record<string, { name: string; color: string }> | null;
  dailyActivity: { date: string; count: number }[];
  draftsUsed: number;
  isProUser: boolean;
}

const DEFAULT_CATEGORIES: Record<string, { name: string; color: string }> = {
  "1": { name: "To Respond", color: "#3b82f6" },
  "2": { name: "FYI", color: "#8b5cf6" },
  "3": { name: "Comment", color: "#f59e0b" },
  "4": { name: "Notification", color: "#6b7280" },
  "5": { name: "Meeting", color: "#10b981" },
  "6": { name: "Marketing", color: "#ef4444" },
};

const FREE_DRAFT_LIMIT = 10;

export default function AnalyticsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    const email = localStorage.getItem("userEmail");
    if (!email) {
      router.push("/");
      return;
    }
    setUserEmail(email);
  }, [router]);

  useEffect(() => {
    if (!userEmail) return;

    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`/api/analytics?userEmail=${userEmail}`);
        const result = await res.json();
        if (res.ok) {
          setData(result);
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [userEmail]);

  const handleUpgrade = async () => {
    if (!userEmail) return;
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Failed to create checkout:", error);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const categories = data?.categories || DEFAULT_CATEGORIES;

  // Prepare category chart data
  const categoryChartData = Object.entries(data?.categoryBreakdown || {})
    .map(([cat, count]) => ({
      name: categories[cat]?.name || `Category ${cat}`,
      count,
      color: categories[cat]?.color || "#6b7280",
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate dynamic width for category labels based on longest name
  const longestCategoryName = categoryChartData.reduce(
    (max, item) => (item.name.length > max ? item.name.length : max),
    0
  );
  // Approximate 7px per character + 20px padding, min 80px, max 160px
  const categoryLabelWidth = Math.min(Math.max(longestCategoryName * 7 + 20, 80), 160);

  // Format daily activity data for chart
  const activityChartData = (data?.dailyActivity || []).map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    count: item.count,
  }));

  // Check if we have at least 3 days with activity
  const daysWithActivity = activityChartData.filter((d) => d.count > 0).length;
  const hasEnoughActivityData = daysWithActivity >= 3;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-60 flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
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
            <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
              Not signed in
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">
              Please sign in to access analytics.
            </p>
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
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 px-8 py-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-[var(--accent)]" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Analytics
              </h1>
              <p className="text-[var(--text-muted)]">
                Track your email processing activity
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Emails */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2.5">
                  <Mail className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Total Emails</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {data?.overview.totalEmails.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">All time</p>
            </div>

            {/* Monthly Emails */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2.5">
                  <Mail className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">This Month</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {data?.overview.monthlyEmails.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">Emails processed</p>
            </div>

            {/* Monthly Drafts */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2.5">
                  <FileText className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Drafts Created</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {data?.overview.monthlyDrafts.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">This month</p>
            </div>

            {/* Response Rate */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2.5">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-[var(--text-muted)]">Response Rate</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {data?.overview.responseRate || 0}%
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">Drafts / needs response</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Category Breakdown */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                Category Breakdown
              </h2>
              {categoryChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                        width={categoryLabelWidth}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          color: "var(--text-primary)",
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center">
                  <p className="text-[var(--text-muted)]">No data yet</p>
                </div>
              )}
            </div>

            {/* Activity Over Time */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                Activity (Last 14 Days)
              </h2>
              {hasEnoughActivityData ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                        interval={1}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          color: "var(--text-primary)",
                        }}
                        formatter={(value) => [`${value}`, "Emails"]}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <BarChart3 className="h-12 w-12 text-[var(--text-muted)] mb-3 opacity-50" />
                  <p className="text-[var(--text-secondary)] font-medium">Keep using Zeno to see your activity trends</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">Activity data will appear here after a few days</p>
                </div>
              )}
            </div>
          </div>

          {/* Draft Usage - Only for free users */}
          {!data?.isProUser && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Draft Usage
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {data?.draftsUsed || 0} / {FREE_DRAFT_LIMIT} drafts used on free plan
                  </p>
                </div>
                <button
                  onClick={handleUpgrade}
                  disabled={upgradeLoading}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {upgradeLoading ? "Loading..." : "Upgrade for Unlimited"}
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                    style={{
                      width: `${Math.min(((data?.draftsUsed || 0) / FREE_DRAFT_LIMIT) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-[var(--text-muted)]">
                  <span>{data?.draftsUsed || 0} used</span>
                  <span>{FREE_DRAFT_LIMIT - (data?.draftsUsed || 0)} remaining</span>
                </div>
              </div>

              {/* Warning if close to limit */}
              {(data?.draftsUsed || 0) >= FREE_DRAFT_LIMIT - 2 && (
                <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                  <p className="text-sm text-amber-400">
                    {(data?.draftsUsed || 0) >= FREE_DRAFT_LIMIT
                      ? "You've reached your free draft limit. Upgrade to Pro for unlimited drafts."
                      : `Only ${FREE_DRAFT_LIMIT - (data?.draftsUsed || 0)} drafts remaining. Upgrade to Pro for unlimited drafts.`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
