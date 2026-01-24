"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Tag, Mail, Shield, Sparkles, Settings, CreditCard } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const FREE_DRAFT_LIMIT = 10;

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/categorize", label: "Categorize", icon: Tag },
  { href: "/drafts", label: "Drafts", icon: Mail },
  { href: "/account", label: "Settings", icon: Settings },
];

const adminNavItem = { href: "/admin", label: "Admin", icon: Shield };

interface User {
  email: string;
  name: string;
  picture?: string;
  isAdmin?: boolean;
  subscriptionStatus?: string;
  draftsCreatedCount?: number;
}

export default function Sidebar() {
  const pathname = usePathname();

  // Initialize state from localStorage to prevent flicker on navigation
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) return null;
    return {
      email: userEmail,
      name: localStorage.getItem("userName") || userEmail.split("@")[0],
      picture: localStorage.getItem("userPicture") || undefined,
      subscriptionStatus: localStorage.getItem("subscriptionStatus") || undefined,
      draftsCreatedCount: parseInt(localStorage.getItem("draftsCreatedCount") || "0", 10),
    };
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("isAdmin") === "true";
  });

  const [upgrading, setUpgrading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(() => {
    if (typeof window === "undefined") return false;
    // Consider data loaded if we have cached subscription status
    return !!localStorage.getItem("subscriptionStatus");
  });

  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");

    if (userEmail) {
      // Fetch fresh user data in background
      fetch(`/api/settings?userEmail=${userEmail}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            // Cache in localStorage to prevent flicker on future navigations
            localStorage.setItem("subscriptionStatus", data.user.subscription_status || "trial");
            localStorage.setItem("draftsCreatedCount", String(data.user.drafts_created_count || 0));
            localStorage.setItem("isAdmin", data.user.is_admin ? "true" : "false");

            setUser((prev) => prev ? {
              ...prev,
              subscriptionStatus: data.user.subscription_status || "trial",
              draftsCreatedCount: data.user.drafts_created_count || 0,
            } : null);
            setIsAdmin(!!data.user.is_admin);
          }
          setDataLoaded(true);
        })
        .catch(() => {
          setDataLoaded(true);
        });
    } else {
      setDataLoaded(true);
    }
  }, []);

  // Build nav items - add Admin before Settings if user is admin
  const navItems = isAdmin
    ? [...baseNavItems.slice(0, 3), adminNavItem, baseNavItems[3]]
    : baseNavItems;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("userPicture");
    localStorage.removeItem("subscriptionStatus");
    localStorage.removeItem("draftsCreatedCount");
    localStorage.removeItem("isAdmin");
    window.location.href = "/";
  };

  const handleUpgrade = async () => {
    if (!user?.email) return;
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: user.email }),
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
  };

  const handleManageSubscription = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: user.email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to open customer portal:", error);
    }
  };

  const draftsRemaining = Math.max(0, FREE_DRAFT_LIMIT - (user?.draftsCreatedCount || 0));
  const isProUser = user?.subscriptionStatus === "active";

  return (
    <aside className="sidebar-bg fixed left-0 top-0 z-40 flex h-screen w-64 flex-col overflow-y-auto border-r border-[var(--border)]">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <Logo />
        <ThemeToggle />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-[var(--accent-muted)] text-[var(--accent)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? "text-[var(--accent)]" : ""
                    }`}
                  />
                  {item.label}
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto">
        {/* Subscription Status */}
        {user && (
          <div className="border-t border-[var(--border)] px-4 py-4">
            {!dataLoaded ? (
              /* Loading skeleton */
              <div className="rounded-lg bg-[var(--bg-elevated)] p-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-14 animate-pulse rounded bg-[var(--border)]" />
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--border)]" />
                </div>
                <div className="mt-2.5 h-1 animate-pulse rounded-full bg-[var(--border)]" />
              </div>
            ) : isProUser ? (
              <div className="rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-3 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">Pro Plan</span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">Unlimited drafts</p>
                <button
                  onClick={handleManageSubscription}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <CreditCard className="h-3 w-3" />
                  Manage
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-[var(--bg-elevated)] px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Free Plan</span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {draftsRemaining} drafts left
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                    style={{ width: `${((user?.draftsCreatedCount || 0) / FREE_DRAFT_LIMIT) * 100}%` }}
                  />
                </div>
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-blue-500 to-purple-500 px-2.5 py-1.5 text-[11px] font-medium text-white transition-all hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" />
                  {upgrading ? "Loading..." : "Upgrade to Pro"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* User Profile */}
        <div className="border-t border-[var(--border)] px-4 py-4">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="h-9 w-9 rounded-full ring-2 ring-[var(--border)]"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-semibold text-white">
                    {getInitials(user.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--bg-elevated)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--bg-elevated)]" />
                <div className="h-2 w-28 animate-pulse rounded bg-[var(--bg-elevated)]" />
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
