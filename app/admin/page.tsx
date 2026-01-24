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
} from "lucide-react";

interface UserRecord {
  email: string;
  name: string;
  picture?: string;
  is_admin?: boolean;
  subscription_status?: string;
  subscription_tier?: string;
  trial_ends_at?: string;
  created_at?: string;
  updated_at?: string;
  emails_processed?: number;
}

interface Stats {
  totalUsers: number;
  activeTrials: number;
  paidUsers: number;
  expiredTrials: number;
  totalEmailsProcessed: number;
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
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
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
  });

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  async function checkAdminAndFetchData() {
    const userEmail = localStorage.getItem("userEmail");

    if (!userEmail) {
      router.push("/");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?userEmail=${userEmail}`);
      const data = await res.json();

      if (!data.isAdmin) {
        router.push("/dashboard");
        return;
      }

      setIsAdmin(true);
      setUsers(data.users || []);

      // Calculate stats
      const now = new Date();
      const usersData = data.users || [];

      const paidUsers = usersData.filter(
        (u: UserRecord) =>
          u.subscription_status === "active" && u.subscription_tier === "pro"
      ).length;

      const activeTrials = usersData.filter((u: UserRecord) => {
        const trialEnds = u.trial_ends_at ? new Date(u.trial_ends_at) : null;
        return (
          (u.subscription_status === "trial" || !u.subscription_status) &&
          trialEnds &&
          trialEnds > now
        );
      }).length;

      const expiredTrials = usersData.filter((u: UserRecord) => {
        const trialEnds = u.trial_ends_at ? new Date(u.trial_ends_at) : null;
        return (
          (u.subscription_status === "trial" || !u.subscription_status) &&
          trialEnds &&
          trialEnds <= now
        );
      }).length;

      const totalEmailsProcessed = usersData.reduce(
        (acc: number, u: UserRecord) => acc + (u.emails_processed || 0),
        0
      );

      setStats({
        totalUsers: usersData.length,
        activeTrials,
        paidUsers,
        expiredTrials,
        totalEmailsProcessed,
      });
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Sidebar />
        <main className="ml-64 flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar />

      <main className="ml-64 min-h-screen overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 px-8 py-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Admin Portal
              </h1>
              <p className="text-zinc-500">Manage users and subscriptions</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Stats Cards */}
          <div className="mb-8 grid grid-cols-5 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats.totalUsers}
                  </p>
                  <p className="text-sm text-zinc-500">Total Users</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats.activeTrials}
                  </p>
                  <p className="text-sm text-zinc-500">Active Trials</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats.paidUsers}
                  </p>
                  <p className="text-sm text-zinc-500">Paid Users</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats.expiredTrials}
                  </p>
                  <p className="text-sm text-zinc-500">Expired Trials</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <Mail className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {stats.totalEmailsProcessed.toLocaleString()}
                  </p>
                  <p className="text-sm text-zinc-500">Emails Processed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">All Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Signed Up</th>
                    <th className="px-6 py-3 font-medium">Emails</th>
                    <th className="px-6 py-3 font-medium">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {users.map((user) => (
                    <tr
                      key={user.email}
                      className="transition-colors hover:bg-zinc-800/50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.picture ? (
                            <img
                              src={user.picture}
                              alt={user.name || user.email}
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-sm font-medium text-white">
                              {(user.name || user.email)[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-white">
                              {user.name || "—"}
                            </p>
                            <p className="text-sm text-zinc-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(user)}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400">
                        {user.emails_processed?.toLocaleString() || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400">
                        {formatDate(user.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
