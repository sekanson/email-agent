"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Users,
  Clock,
  CreditCard,
  AlertTriangle,
  Mail,
  Loader2,
  Shield,
  X,
  Search,
  FileText,
  Calendar,
  Pause,
  Play,
  Ban,
  Gift,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Download,
  TrendingUp,
  UserPlus,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface UserRecord {
  id?: string;
  email: string;
  name: string;
  picture?: string;
  is_admin?: boolean;
  role?: "user" | "admin" | "owner" | "primary_owner";
  subscription_status?: string;
  subscription_tier?: string;
  trial_ends_at?: string;
  created_at?: string;
  updated_at?: string;
  emails_processed?: number;
  drafts_created_count?: number;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  labels_created?: boolean;
  refresh_token?: string;
  auto_poll_enabled?: boolean;
}

type Role = "user" | "admin" | "owner" | "primary_owner";

const ROLE_LABELS: Record<Role, string> = {
  user: "User",
  admin: "Admin",
  owner: "Owner",
  primary_owner: "Primary Owner",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  user: "Can use the app",
  admin: "Can manage user membership",
  owner: "Can manage user roles and admin settings",
  primary_owner: "Can manage org and data settings",
};

function getRoleBadge(role?: Role) {
  const r = role || "user";
  switch (r) {
    case "primary_owner":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Primary Owner
        </span>
      );
    case "owner":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-400">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
          Owner
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Admin
        </span>
      );
    default:
      return null;
  }
}

interface Stats {
  totalUsers: number;
  activeTrials: number;
  paidUsers: number;
  expiredTrials: number;
  totalEmailsProcessed: number;
  totalDraftsCreated: number;
  newUsersThisWeek: number;
  conversionRate: number;
}

function getStatusBadge(user: UserRecord) {
  const status = user.subscription_status || "trial";
  const tier = user.subscription_tier || "trial";
  const trialEnds = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const now = new Date();
  const daysLeft = trialEnds
    ? Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (status === "active" && tier === "pro") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Paid
      </span>
    );
  }

  if (status === "paused") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Paused
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-1 text-xs font-medium text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        Cancelled
      </span>
    );
  }

  if (status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Past Due
      </span>
    );
  }

  // Trial status
  if (trialEnds && daysLeft <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Expired
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
      Trial ({daysLeft}d left)
    </span>
  );
}

function getSyncStatusBadge(user: UserRecord) {
  // Check if auto-polling is explicitly disabled
  if (user.auto_poll_enabled === false) {
    return {
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-1 text-xs font-medium text-zinc-400">
          <Pause className="h-3 w-3" />
          Disabled
        </span>
      ),
      reason: "User has disabled automatic email processing",
    };
  }

  // Check if user has no refresh token
  if (!user.refresh_token) {
    return {
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
          <XCircle className="h-3 w-3" />
          No Token
        </span>
      ),
      reason: "User needs to re-authenticate with Gmail",
    };
  }

  // Check if labels are not set up
  if (!user.labels_created) {
    return {
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
          <AlertCircle className="h-3 w-3" />
          Setup Needed
        </span>
      ),
      reason: "User hasn't completed Gmail label setup",
    };
  }

  // All good - syncing
  return {
    badge: (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </span>
    ),
    reason: "Emails are being processed automatically every 5 minutes",
  };
}

function formatDate(dateString?: string) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeTrials: 0,
    paidUsers: 0,
    expiredTrials: 0,
    totalEmailsProcessed: 0,
    totalDraftsCreated: 0,
    newUsersThisWeek: 0,
    conversionRate: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<UserRecord[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<Role>("user");

  // Permission checks
  const canManageRoles = ["owner", "primary_owner"].includes(currentUserRole);
  const canManageOwners = currentUserRole === "primary_owner";

  const adminEmail = typeof window !== "undefined"
    ? localStorage.getItem("userEmail") || ""
    : "";

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  async function checkAdminAndFetchData() {
    if (!adminEmail) {
      router.push("/");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?userEmail=${adminEmail}`);
      const data = await res.json();

      if (!data.isAdmin) {
        router.push("/dashboard");
        return;
      }

      setIsAdmin(true);
      setCurrentUserRole(data.currentUserRole || "admin");
      setUsers(data.users || []);
      calculateStats(data.users || []);
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(usersData: UserRecord[]) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const paidUsers = usersData.filter(
      (u) => u.subscription_status === "active" && u.subscription_tier === "pro"
    ).length;

    const activeTrials = usersData.filter((u) => {
      const trialEnds = u.trial_ends_at ? new Date(u.trial_ends_at) : null;
      return (
        (u.subscription_status === "trial" || !u.subscription_status) &&
        trialEnds &&
        trialEnds > now
      );
    }).length;

    const expiredTrials = usersData.filter((u) => {
      const trialEnds = u.trial_ends_at ? new Date(u.trial_ends_at) : null;
      return (
        (u.subscription_status === "trial" || !u.subscription_status) &&
        trialEnds &&
        trialEnds <= now
      );
    }).length;

    const totalEmailsProcessed = usersData.reduce(
      (acc, u) => acc + (u.emails_processed || 0),
      0
    );

    const totalDraftsCreated = usersData.reduce(
      (acc, u) => acc + (u.drafts_created_count || 0),
      0
    );

    const newUsersThisWeek = usersData.filter((u) => {
      const createdAt = u.created_at ? new Date(u.created_at) : null;
      return createdAt && createdAt > oneWeekAgo;
    }).length;

    // Conversion rate: paid users / (paid users + expired trials)
    const totalConverted = paidUsers + expiredTrials;
    const conversionRate = totalConverted > 0 ? (paidUsers / totalConverted) * 100 : 0;

    // Recent activity - last 5 signups
    const recentSignups = [...usersData]
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);

    setRecentActivity(recentSignups);

    setStats({
      totalUsers: usersData.length,
      activeTrials,
      paidUsers,
      expiredTrials,
      totalEmailsProcessed,
      totalDraftsCreated,
      newUsersThisWeek,
      conversionRate,
    });
  }

  async function handleSubscriptionAction(action: string) {
    if (!selectedUser) return;

    setActionLoading(action);
    try {
      const res = await fetch("/api/admin/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail,
          targetUserEmail: selectedUser.email,
          action,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Refresh user data
        await checkAdminAndFetchData();
        // Update selected user
        const updatedUser = users.find((u) => u.email === selectedUser.email);
        if (updatedUser) {
          setSelectedUser(updatedUser);
        }
      } else {
        alert(data.error || "Action failed");
      }
    } catch (error) {
      console.error("Action failed:", error);
      alert("Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    // Confirmation for primary_owner transfer
    if (newRole === "primary_owner") {
      const targetUser = users.find((u) => u.id === userId);
      const confirmed = window.confirm(
        `⚠️ TRANSFER PRIMARY OWNERSHIP\n\nYou are about to transfer Primary Owner to:\n${targetUser?.name || targetUser?.email}\n\nThis will:\n• Demote you from Primary Owner to Owner\n• Transfer all primary owner privileges to this user\n• This action can only be reversed by the new Primary Owner\n\nAre you absolutely sure?`
      );
      if (!confirmed) return;

      // Double confirmation
      const doubleConfirmed = window.confirm(
        `FINAL CONFIRMATION\n\nType "TRANSFER" in the next prompt to confirm transferring Primary Owner to ${targetUser?.name || targetUser?.email}.`
      );
      if (!doubleConfirmed) return;

      const typed = window.prompt('Type "TRANSFER" to confirm:');
      if (typed !== "TRANSFER") {
        alert("Transfer cancelled. You must type TRANSFER exactly.");
        return;
      }
    }

    setActionLoading("role");
    try {
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterEmail: adminEmail,
          targetUserId: userId,
          newRole,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Refresh user data
        await checkAdminAndFetchData();
        // Update selected user if it's the one being modified
        if (selectedUser?.id === userId) {
          const updatedUser = users.find((u) => u.id === userId);
          if (updatedUser) {
            setSelectedUser({ ...updatedUser, role: newRole as Role });
          }
        }
      } else {
        alert(data.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Role update failed:", error);
      alert("Failed to update role");
    } finally {
      setActionLoading(null);
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function exportUsersToCSV() {
    const headers = [
      "Email",
      "Name",
      "Status",
      "Tier",
      "Emails Processed",
      "Drafts Created",
      "Signed Up",
      "Trial Ends",
      "Is Admin",
      "Stripe Customer ID",
    ];

    const rows = users.map((u) => [
      u.email,
      u.name || "",
      u.subscription_status || "trial",
      u.subscription_tier || "free",
      u.emails_processed || 0,
      u.drafts_created_count || 0,
      u.created_at || "",
      u.trial_ends_at || "",
      u.is_admin ? "Yes" : "No",
      u.stripe_customer_id || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `zeno-users-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedUser.email}? This will permanently remove all their data including emails and settings. This action cannot be undone.`
    );

    if (confirmed) {
      await handleSubscriptionAction("delete_user");
      setSelectedUser(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="ml-60 flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      <main className="ml-60 min-h-screen overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 px-8 py-6 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-blue-500" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                  Admin Portal
                </h1>
                <p className="text-[var(--text-muted)]">Manage users and subscriptions</p>
              </div>
            </div>
            <button
              onClick={exportUsersToCSV}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Stats Cards - Row 1 */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {stats.totalUsers}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Total Users</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {stats.paidUsers}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Paid Users</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {stats.activeTrials}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Active Trials</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {stats.expiredTrials}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Expired Trials</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards - Row 2 */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cyan-500/10 p-2">
                  <UserPlus className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {stats.newUsersThisWeek}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">New This Week</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {stats.conversionRate.toFixed(1)}%
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Conversion Rate</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <Mail className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {stats.totalEmailsProcessed.toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Emails Processed</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {stats.totalDraftsCreated.toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">Drafts Created</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Recent Signups
              </h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {recentActivity.map((user) => (
                <div
                  key={user.email}
                  className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <div className="flex items-center gap-3">
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name || user.email}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-sm font-medium text-[var(--text-primary)]">
                        {(user.name || user.email)[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {user.name || user.email}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(user)}
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {formatDate(user.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                All Users ({filteredUsers.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-sm text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Role</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Sync</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Signed Up</th>
                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Emails</th>
                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Drafts</th>
                    <th className="px-2 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.email}
                      className="cursor-pointer transition-colors hover:bg-[var(--bg-elevated)]"
                      onClick={() => setSelectedUser(user)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {user.picture ? (
                            <img
                              src={user.picture}
                              alt={user.name || user.email}
                              className="h-8 w-8 flex-shrink-0 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-sm font-medium text-[var(--text-primary)]">
                              {(user.name || user.email)[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate">
                              {user.name || "—"}
                            </p>
                            <p className="text-sm text-[var(--text-muted)] truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{getRoleBadge(user.role)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(user)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{getSyncStatusBadge(user).badge}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)] text-right whitespace-nowrap">
                        {user.emails_processed?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)] text-right whitespace-nowrap">
                        {user.drafts_created_count || 0}
                      </td>
                      <td className="px-2 py-3">
                        <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* User Detail Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedUser(null)}
          />

          {/* Drawer */}
          <div className="relative w-full max-w-md bg-[var(--bg-primary)] shadow-2xl">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  User Details
                </h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* User Info */}
                <div className="mb-6 flex items-center gap-4">
                  {selectedUser.picture ? (
                    <img
                      src={selectedUser.picture}
                      alt={selectedUser.name || selectedUser.email}
                      className="h-16 w-16 rounded-full"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-xl font-medium text-[var(--text-primary)]">
                      {(selectedUser.name || selectedUser.email)[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">
                      {selectedUser.name || "No name"}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">{selectedUser.email}</p>
                    <div className="mt-2">{getStatusBadge(selectedUser)}</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="mb-6 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[var(--bg-card)] p-4">
                    <div className="flex items-center gap-2 text-[var(--text-muted)]">
                      <Mail className="h-4 w-4" />
                      <span className="text-xs">Emails Processed</span>
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                      {selectedUser.emails_processed?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-card)] p-4">
                    <div className="flex items-center gap-2 text-[var(--text-muted)]">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs">Drafts Created</span>
                    </div>
                    <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                      {selectedUser.drafts_created_count || 0}
                    </p>
                  </div>
                </div>

                {/* Sync Status */}
                <div className="mb-6 rounded-lg bg-[var(--bg-card)] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-[var(--text-muted)]" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">Sync Status</span>
                    </div>
                    {getSyncStatusBadge(selectedUser).badge}
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {getSyncStatusBadge(selectedUser).reason}
                  </p>
                </div>

                {/* Details */}
                <div className="mb-6 space-y-3">
                  <div className="flex justify-between rounded-lg bg-[var(--bg-card)] p-3">
                    <span className="text-sm text-[var(--text-muted)]">Signed Up</span>
                    <span className="text-sm text-[var(--text-primary)]">
                      {formatDate(selectedUser.created_at)}
                    </span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-[var(--bg-card)] p-3">
                    <span className="text-sm text-[var(--text-muted)]">Last Active</span>
                    <span className="text-sm text-[var(--text-primary)]">
                      {formatDate(selectedUser.updated_at)}
                    </span>
                  </div>
                  {selectedUser.trial_ends_at && (
                    <div className="flex justify-between rounded-lg bg-[var(--bg-card)] p-3">
                      <span className="text-sm text-[var(--text-muted)]">Trial Ends</span>
                      <span className="text-sm text-[var(--text-primary)]">
                        {formatDate(selectedUser.trial_ends_at)}
                      </span>
                    </div>
                  )}
                  {selectedUser.stripe_customer_id && (
                    <div className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] p-3">
                      <span className="text-sm text-[var(--text-muted)]">Stripe Customer</span>
                      <a
                        href={`https://dashboard.stripe.com/customers/${selectedUser.stripe_customer_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View in Stripe
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Actions
                  </p>

                  {/* Subscription Actions */}
                  {selectedUser.subscription_status === "active" && (
                    <>
                      <button
                        onClick={() => handleSubscriptionAction("pause")}
                        disabled={!!actionLoading}
                        className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                      >
                        {actionLoading === "pause" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Pause className="h-4 w-4 text-amber-400" />
                        )}
                        Pause Subscription
                      </button>
                      <button
                        onClick={() => handleSubscriptionAction("cancel")}
                        disabled={!!actionLoading}
                        className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                      >
                        {actionLoading === "cancel" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="h-4 w-4 text-red-400" />
                        )}
                        Cancel at Period End
                      </button>
                    </>
                  )}

                  {selectedUser.subscription_status === "paused" && (
                    <button
                      onClick={() => handleSubscriptionAction("resume")}
                      disabled={!!actionLoading}
                      className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                    >
                      {actionLoading === "resume" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 text-emerald-400" />
                      )}
                      Resume Subscription
                    </button>
                  )}

                  {/* Trial Actions */}
                  {(selectedUser.subscription_status === "trial" || !selectedUser.subscription_status) && (
                    <>
                      <button
                        onClick={() => handleSubscriptionAction("extend_trial")}
                        disabled={!!actionLoading}
                        className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                      >
                        {actionLoading === "extend_trial" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Calendar className="h-4 w-4 text-blue-400" />
                        )}
                        Extend Trial (+14 days)
                      </button>
                      <button
                        onClick={() => handleSubscriptionAction("grant_pro")}
                        disabled={!!actionLoading}
                        className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                      >
                        {actionLoading === "grant_pro" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Gift className="h-4 w-4 text-purple-400" />
                        )}
                        Grant Pro Access
                      </button>
                    </>
                  )}

                  {/* Always available */}
                  <button
                    onClick={() => handleSubscriptionAction("reset_drafts")}
                    disabled={!!actionLoading}
                    className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                  >
                    {actionLoading === "reset_drafts" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 text-[var(--text-muted)]" />
                    )}
                    Reset Draft Count
                  </button>

                  {selectedUser.subscription_status === "active" && selectedUser.subscription_tier === "pro" && (
                    <button
                      onClick={() => handleSubscriptionAction("revoke_pro")}
                      disabled={!!actionLoading}
                      className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                    >
                      {actionLoading === "revoke_pro" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Ban className="h-4 w-4 text-red-400" />
                      )}
                      Revoke Pro Access
                    </button>
                  )}

                  {/* Role Management */}
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Role Management
                    </p>

                    <div className="rounded-lg bg-[var(--bg-card)] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--text-muted)]">Current Role</span>
                        {getRoleBadge(selectedUser.role)}
                      </div>

                      {/* Role Selector */}
                      {canManageRoles && selectedUser.role !== "primary_owner" && selectedUser.email !== adminEmail ? (
                        <div className="mt-3">
                          <select
                            value={selectedUser.role || "user"}
                            onChange={(e) => selectedUser.id && handleRoleChange(selectedUser.id, e.target.value)}
                            disabled={actionLoading === "role"}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            {canManageOwners && <option value="owner">Owner</option>}
                            {canManageOwners && <option value="primary_owner">Primary Owner</option>}
                          </select>
                          <p className="mt-2 text-xs text-[var(--text-muted)]">
                            {ROLE_DESCRIPTIONS[(selectedUser.role || "user") as Role]}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                          {selectedUser.email === adminEmail
                            ? "Cannot change your own role"
                            : selectedUser.role === "primary_owner"
                            ? "Primary owner role cannot be changed"
                            : !canManageRoles
                            ? "You don't have permission to manage roles"
                            : ROLE_DESCRIPTIONS[(selectedUser.role || "user") as Role]}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-400">
                      Danger Zone
                    </p>

                    <button
                      onClick={handleDeleteUser}
                      disabled={!!actionLoading || selectedUser.email === adminEmail || selectedUser.role === "primary_owner"}
                      className="flex w-full items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-left text-sm text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {actionLoading === "delete_user" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      {selectedUser.email === adminEmail
                        ? "Cannot delete own account"
                        : selectedUser.role === "primary_owner"
                        ? "Cannot delete primary owner"
                        : "Delete User Account"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
