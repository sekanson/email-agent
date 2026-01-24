"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Tag,
  Mail,
  Shield,
  Sparkles,
  Settings,
  CreditCard,
  LogOut,
  ChevronUp,
  BarChart3,
  Moon,
  Sun,
  X,
  AlertTriangle,
} from "lucide-react";
import Logo from "./Logo";

const FREE_DRAFT_LIMIT = 10;

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/categorize", label: "Categorize", icon: Tag },
  { href: "/drafts", label: "Drafts", icon: Mail },
];

const adminNavItem = { href: "/admin", label: "Admin", icon: Shield };

interface User {
  email: string;
  name: string;
  picture?: string;
  isAdmin?: boolean;
  subscriptionStatus?: string;
  draftsCreatedCount?: number;
  emailsProcessed?: number;
}

export default function Sidebar() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

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
      emailsProcessed: parseInt(localStorage.getItem("emailsProcessed") || "0", 10),
    };
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("isAdmin") === "true";
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");

    if (userEmail) {
      fetch(`/api/settings?userEmail=${userEmail}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            localStorage.setItem("subscriptionStatus", data.user.subscription_status || "trial");
            localStorage.setItem("draftsCreatedCount", String(data.user.drafts_created_count || 0));
            localStorage.setItem("isAdmin", data.user.is_admin ? "true" : "false");

            setUser((prev) =>
              prev
                ? {
                    ...prev,
                    subscriptionStatus: data.user.subscription_status || "trial",
                    draftsCreatedCount: data.user.drafts_created_count || 0,
                  }
                : null
            );
            setIsAdmin(!!data.user.is_admin);
          }
        })
        .catch(() => {});

      // Fetch email count
      fetch(`/api/emails?userEmail=${userEmail}&limit=1`)
        .then((res) => res.json())
        .then((data) => {
          if (data.metrics?.totalAll !== undefined) {
            localStorage.setItem("emailsProcessed", String(data.metrics.totalAll));
            setUser((prev) =>
              prev ? { ...prev, emailsProcessed: data.metrics.totalAll } : null
            );
          }
        })
        .catch(() => {});
    }
  }, []);

  const navItems = isAdmin ? [...baseNavItems, adminNavItem] : baseNavItems;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogOut = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("userPicture");
    localStorage.removeItem("subscriptionStatus");
    localStorage.removeItem("draftsCreatedCount");
    localStorage.removeItem("emailsProcessed");
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

  const handleCancelSubscription = async () => {
    if (!user?.email) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: user.email }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("subscriptionStatus", "cancelled");
        setUser((prev) => (prev ? { ...prev, subscriptionStatus: "cancelled" } : null));
        setShowCancelModal(false);
        setMenuOpen(false);
      } else {
        alert(data.error || "Failed to cancel subscription");
      }
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      alert("Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const handleManageBilling = async () => {
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
      console.error("Failed to open billing portal:", error);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const isProUser = user?.subscriptionStatus === "active";
  const draftsRemaining = Math.max(0, FREE_DRAFT_LIMIT - (user?.draftsCreatedCount || 0));

  return (
    <>
      <aside className="sidebar-bg fixed left-0 top-0 z-40 flex h-screen w-64 flex-col overflow-y-auto border-r border-[var(--border)]">
        {/* Logo */}
        <div className="flex items-center px-4 py-4">
          <Logo />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? "text-[var(--accent)]" : ""
                      }`}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Profile Button */}
        {user && (
          <div className="relative p-3" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--bg-elevated)]"
            >
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-semibold text-white">
                  {getInitials(user.name)}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {user.name}
                </p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {isProUser ? "Pro" : "Free"} plan
                </p>
              </div>
              <ChevronUp
                className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${
                  menuOpen ? "" : "rotate-180"
                }`}
              />
            </button>

            {/* Popup Menu */}
            {menuOpen && (
              <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-xl">
                {/* User Info Header */}
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{user.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                </div>

                {/* Usage Stats */}
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Usage</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">Emails processed</span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {user.emailsProcessed || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">Drafts created</span>
                      <span className="font-medium text-[var(--text-primary)]">
                        {user.draftsCreatedCount || 0}
                        {!isProUser && (
                          <span className="text-[var(--text-muted)]"> / {FREE_DRAFT_LIMIT}</span>
                        )}
                      </span>
                    </div>
                    {!isProUser && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                          style={{
                            width: `${((user.draftsCreatedCount || 0) / FREE_DRAFT_LIMIT) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>

                  {isProUser ? (
                    <>
                      <button
                        onClick={handleManageBilling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        <CreditCard className="h-4 w-4" />
                        Billing
                      </button>
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <X className="h-4 w-4" />
                        Cancel subscription
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleUpgrade}
                      disabled={upgrading}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent-muted)]"
                    >
                      <Sparkles className="h-4 w-4" />
                      {upgrading ? "Loading..." : "Upgrade to Pro"}
                    </button>
                  )}
                </div>

                {/* Theme Toggle */}
                <div className="border-t border-[var(--border)] px-4 py-3">
                  <button
                    onClick={toggleTheme}
                    className="flex w-full items-center justify-between text-sm text-[var(--text-secondary)]"
                  >
                    <div className="flex items-center gap-3">
                      {theme === "dark" ? (
                        <Moon className="h-4 w-4" />
                      ) : (
                        <Sun className="h-4 w-4" />
                      )}
                      <span>Theme</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-[var(--bg-elevated)] p-1">
                      <div
                        className={`rounded-full p-1 ${
                          theme === "light" ? "bg-[var(--bg-primary)]" : ""
                        }`}
                      >
                        <Sun className="h-3 w-3" />
                      </div>
                      <div
                        className={`rounded-full p-1 ${
                          theme === "dark" ? "bg-[var(--bg-primary)]" : ""
                        }`}
                      >
                        <Moon className="h-3 w-3" />
                      </div>
                    </div>
                  </button>
                </div>

                {/* Log Out */}
                <div className="border-t border-[var(--border)] py-1">
                  <button
                    onClick={handleLogOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Cancel Subscription</h3>
            </div>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Are you sure you want to cancel your Pro subscription? You'll lose access to:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Unlimited AI-generated drafts
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Priority email processing
              </li>
            </ul>
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Your subscription will remain active until the end of your current billing period.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                Keep subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Cancel subscription"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
