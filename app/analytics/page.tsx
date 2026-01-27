"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  BarChart3,
  Mail,
  FileText,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertCircle,
  Sparkles,
  Clock,
  Users,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Inbox,
  Send,
  Archive,
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
  PieChart,
  Pie,
  AreaChart,
  Area,
  Legend,
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
  "1": { name: "To Respond", color: "#ef4444" },
  "2": { name: "FYI", color: "#f59e0b" },
  "3": { name: "Comment", color: "#8b5cf6" },
  "4": { name: "Notification", color: "#3b82f6" },
  "5": { name: "Meeting Update", color: "#6366f1" },
  "6": { name: "Marketing", color: "#f97316" },
  "7": { name: "Awaiting Reply", color: "#06b6d4" },
  "8": { name: "Actioned", color: "#22c55e" },
};

const FREE_DRAFT_LIMIT = 10;

// Simulated additional data (would come from API in production)
const MOCK_TOP_SENDERS = [
  { name: "Google", domain: "google.com", count: 23, color: "#4285f4" },
  { name: "GitHub", domain: "github.com", count: 18, color: "#333" },
  { name: "Stripe", domain: "stripe.com", count: 12, color: "#635bff" },
  { name: "Notion", domain: "notion.so", count: 8, color: "#000" },
  { name: "Linear", domain: "linear.app", count: 6, color: "#5e6ad2" },
];

const MOCK_HOURLY_ACTIVITY = [
  { hour: "6am", emails: 2 },
  { hour: "8am", emails: 8 },
  { hour: "10am", emails: 15 },
  { hour: "12pm", emails: 12 },
  { hour: "2pm", emails: 18 },
  { hour: "4pm", emails: 14 },
  { hour: "6pm", emails: 8 },
  { hour: "8pm", emails: 5 },
  { hour: "10pm", emails: 3 },
];

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
      value: count,
      color: categories[cat]?.color || "#6b7280",
    }))
    .sort((a, b) => b.value - a.value);

  // Total emails in categories
  const totalCategorized = categoryChartData.reduce((sum, item) => sum + item.value, 0);

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

  // Calculate estimated time saved (2 min per email on average)
  const timeSavedMinutes = (data?.overview.totalEmails || 0) * 2;
  const timeSavedHours = Math.floor(timeSavedMinutes / 60);
  const timeSavedDisplay = timeSavedHours > 0 ? `${timeSavedHours}h ${timeSavedMinutes % 60}m` : `${timeSavedMinutes}m`;

  // Mock week-over-week change
  const weekChange = 12; // +12% this week vs last

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-60 flex min-h-screen items-center justify-center max-md:ml-0 max-md:pb-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-60 flex min-h-screen items-center justify-center max-md:ml-0 max-md:pb-20">
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

      <main className="ml-60 min-h-screen overflow-auto max-md:ml-0 max-md:pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 px-8 py-6 backdrop-blur-xl max-md:px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 p-2.5">
                <BarChart3 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                  Analytics
                </h1>
                <p className="text-sm text-[var(--text-muted)]">
                  Your email productivity insights
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-500">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">+{weekChange}% this week</span>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6 max-md:p-4">
          {/* Hero Stats Row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/* Total Emails */}
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-blue-500/5 to-transparent p-5 transition-all hover:border-blue-500/30">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl transition-all group-hover:bg-blue-500/20" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-blue-500/10 p-2.5">
                    <Mail className="h-5 w-5 text-blue-500" />
                  </div>
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <ArrowUpRight className="h-3 w-3" />
                    All time
                  </span>
                </div>
                <p className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
                  {data?.overview.totalEmails.toLocaleString() || 0}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Total Emails Processed</p>
              </div>
            </div>

            {/* Time Saved */}
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-emerald-500/5 to-transparent p-5 transition-all hover:border-emerald-500/30">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:bg-emerald-500/20" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-emerald-500/10 p-2.5">
                    <Clock className="h-5 w-5 text-emerald-500" />
                  </div>
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <Zap className="h-3 w-3" />
                    Estimated
                  </span>
                </div>
                <p className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
                  {timeSavedDisplay}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Time Saved</p>
              </div>
            </div>

            {/* Drafts Created */}
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-purple-500/5 to-transparent p-5 transition-all hover:border-purple-500/30">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl transition-all group-hover:bg-purple-500/20" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-purple-500/10 p-2.5">
                    <FileText className="h-5 w-5 text-purple-500" />
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">This month</span>
                </div>
                <p className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
                  {data?.overview.monthlyDrafts.toLocaleString() || 0}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Drafts Created</p>
              </div>
            </div>

            {/* Response Rate */}
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-amber-500/5 to-transparent p-5 transition-all hover:border-amber-500/30">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl transition-all group-hover:bg-amber-500/20" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-amber-500/10 p-2.5">
                    <Send className="h-5 w-5 text-amber-500" />
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">Draft rate</span>
                </div>
                <p className="mt-4 text-3xl font-bold text-[var(--text-primary)]">
                  {data?.overview.responseRate || 0}%
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Response Rate</p>
              </div>
            </div>
          </div>

          {/* Main Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Activity Chart - Takes 2 columns */}
            <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Email Activity
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">Last 14 days</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-[var(--text-muted)]">Emails</span>
                  </div>
                </div>
              </div>
              {hasEnoughActivityData ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          color: "var(--text-primary)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value) => [`${value} emails`, "Processed"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorEmails)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-72 flex-col items-center justify-center text-center">
                  <div className="rounded-2xl bg-[var(--bg-elevated)] p-4 mb-4">
                    <BarChart3 className="h-8 w-8 text-[var(--text-muted)]" />
                  </div>
                  <p className="text-[var(--text-secondary)] font-medium">Building your activity graph</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1 max-w-xs">
                    Keep using Zeno and your email trends will appear here
                  </p>
                </div>
              )}
            </div>

            {/* Category Donut */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Categories
                </h2>
                <p className="text-sm text-[var(--text-muted)]">{totalCategorized} emails sorted</p>
              </div>
              {categoryChartData.length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "12px",
                            color: "var(--text-primary)",
                          }}
                          formatter={(value, name) => [`${value} emails`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2 max-h-32 overflow-y-auto">
                    {categoryChartData.slice(0, 5).map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[var(--text-secondary)] truncate max-w-[120px]">
                            {item.name}
                          </span>
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-48 items-center justify-center">
                  <p className="text-[var(--text-muted)]">No data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Second Row - Top Senders & Peak Hours */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top Senders */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Top Senders
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">Most frequent this month</p>
                </div>
                <Users className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <div className="space-y-4">
                {MOCK_TOP_SENDERS.map((sender, index) => (
                  <div key={sender.domain} className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-sm font-bold text-[var(--text-muted)]">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-[var(--text-primary)] truncate">
                          {sender.name}
                        </p>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {sender.count}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(sender.count / MOCK_TOP_SENDERS[0].count) * 100}%`,
                            backgroundColor: sender.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Peak Hours */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Peak Activity Hours
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">When you receive most emails</p>
                </div>
                <Calendar className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_HOURLY_ACTIVITY} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        color: "var(--text-primary)",
                      }}
                      formatter={(value) => [`${value} emails`, "Received"]}
                    />
                    <Bar dataKey="emails" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  <span className="text-[var(--text-muted)]">Peak: 2pm - 4pm</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[var(--text-muted)]">Quiet: 10pm - 6am</span>
                </div>
              </div>
            </div>
          </div>

          {/* Insights Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 p-3">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  AI Insights
                </h2>
                <p className="mt-2 text-[var(--text-secondary)] leading-relaxed">
                  Based on your email patterns, you receive the most emails on <span className="font-medium text-[var(--text-primary)]">Tuesdays</span> and 
                  tend to process them fastest in the <span className="font-medium text-[var(--text-primary)]">morning hours</span>. 
                  Your response rate of <span className="font-medium text-[var(--text-primary)]">{data?.overview.responseRate || 0}%</span> is 
                  {(data?.overview.responseRate || 0) >= 50 ? " above" : " below"} average. 
                  Consider scheduling email time around 2pm when volume peaks.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
                    📈 +{weekChange}% productivity
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                    ⏱️ {timeSavedDisplay} saved
                  </span>
                  <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                    📧 {data?.overview.monthlyEmails || 0} this month
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Draft Usage - Only for free users */}
          {!data?.isProUser && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
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
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {upgradeLoading ? "Loading..." : "Upgrade for Unlimited"}
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
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
                <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
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
