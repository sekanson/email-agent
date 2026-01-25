"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Tag,
  Mail,
  Settings,
  LogOut,
  Moon,
  Sun,
  Shield,
  BarChart3,
  HelpCircle,
  Check,
  Sparkles,
  ChevronUp,
  ChevronRight,
  MessageSquare,
  Calendar,
  FileText,
  ScrollText,
} from "lucide-react";
import Logo from "./Logo";

// Clean nav - just the core items
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/categorize", label: "Categorize", icon: Tag },
  { href: "/drafts", label: "Drafts", icon: Mail },
];

type Role = "user" | "admin" | "owner" | "primary_owner";

interface User {
  email: string;
  name: string;
  picture?: string;
  isAdmin?: boolean;
  subscriptionStatus?: string;
  role?: Role;
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
    };
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("isAdmin") === "true";
  });

  const [userRole, setUserRole] = useState<Role>(() => {
    if (typeof window === "undefined") return "user";
    return (localStorage.getItem("userRole") as Role) || "user";
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setHelpMenuOpen(false);
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
            localStorage.setItem("isAdmin", data.user.is_admin ? "true" : "false");
            localStorage.setItem("userRole", data.user.role || "user");

            setUser((prev) =>
              prev
                ? {
                    ...prev,
                    subscriptionStatus: data.user.subscription_status || "trial",
                    role: data.user.role || "user",
                  }
                : null
            );
            setIsAdmin(!!data.user.is_admin);
            setUserRole(data.user.role || "user");
          }
        })
        .catch(() => {});
    }
  }, []);

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
    localStorage.removeItem("userRole");
    window.location.href = "/";
  };

  const getRoleBadge = () => {
    switch (userRole) {
      case "primary_owner":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            <Shield className="h-2.5 w-2.5" />
            Primary Owner
          </span>
        );
      case "owner":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
            <Shield className="h-2.5 w-2.5" />
            Owner
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
            <Shield className="h-2.5 w-2.5" />
            Admin
          </span>
        );
      default:
        return null;
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleUpgrade = async () => {
    if (!user?.email) return;
    setUpgradeLoading(true);
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
      console.error("Failed to create checkout:", error);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const isProUser = user?.subscriptionStatus === "active";

  return (
    <aside className="sidebar-bg fixed left-0 top-0 z-40 flex h-screen w-60 flex-col overflow-y-auto border-r border-[var(--border)]">
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
        <div className="px-3 pb-4" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--bg-elevated)]"
          >
            {/* Avatar */}
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="h-8 w-8 flex-shrink-0 rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-semibold text-white">
                {getInitials(user.name)}
              </div>
            )}

            {/* Name and Plan/Role */}
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {user.name}
              </p>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {userRole !== "user" ? (
                  getRoleBadge()
                ) : isProUser ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                    <Sparkles className="h-2.5 w-2.5" />
                    PRO
                  </span>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">Free Plan</p>
                )}
              </div>
            </div>

            {/* Chevron */}
            <ChevronUp
              className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${
                menuOpen ? "" : "rotate-180"
              }`}
            />
          </button>

          {/* Popover Menu - Fixed position to avoid layout shift */}
          {menuOpen && (
            <div className="fixed bottom-16 left-3 z-50 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
              {/* Plan Display */}
              <div className="border-b border-[var(--border)] px-2 py-2">
                <div className="flex items-center justify-between rounded-lg px-3 py-2">
                  {isProUser ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      Pro Plan
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--text-primary)]">Free Plan</span>
                  )}
                  <Check className="h-4 w-4 text-emerald-400" />
                </div>
              </div>

              {/* Menu Items */}
              <div className="px-2 py-2">
                {/* Settings */}
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <Settings className="h-4 w-4 text-[var(--text-muted)]" />
                  Settings
                </Link>

                {/* Admin - only for admins */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <Shield className="h-4 w-4 text-[var(--text-muted)]" />
                    Admin
                  </Link>
                )}

                {/* Analytics */}
                <Link
                  href="/analytics"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <BarChart3 className="h-4 w-4 text-[var(--text-muted)]" />
                  Analytics
                </Link>

                {/* Get Help - with submenu */}
                <div className="relative">
                  <button
                    onClick={() => setHelpMenuOpen(!helpMenuOpen)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle className="h-4 w-4 text-[var(--text-muted)]" />
                      <span>Get Help</span>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${helpMenuOpen ? "rotate-90" : ""}`} />
                  </button>

                  {/* Help Submenu */}
                  {helpMenuOpen && (
                    <div className="mt-1 ml-7 space-y-1 border-l border-[var(--border)] pl-3">
                      <a
                        href="mailto:support@xix3d.com"
                        onClick={() => { setMenuOpen(false); setHelpMenuOpen(false); }}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Email Support
                      </a>
                      <a
                        href="https://calendly.com/xix3d"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { setMenuOpen(false); setHelpMenuOpen(false); }}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        Book a Call
                      </a>
                      <div className="my-1.5 border-t border-[var(--border)]" />
                      <Link
                        href="/terms"
                        onClick={() => { setMenuOpen(false); setHelpMenuOpen(false); }}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Terms of Service
                      </Link>
                      <Link
                        href="/privacy"
                        onClick={() => { setMenuOpen(false); setHelpMenuOpen(false); }}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        <ScrollText className="h-3.5 w-3.5" />
                        Privacy Policy
                      </Link>
                    </div>
                  )}
                </div>

                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <div className="flex items-center gap-3">
                    {theme === "dark" ? (
                      <Moon className="h-4 w-4 text-[var(--text-muted)]" />
                    ) : (
                      <Sun className="h-4 w-4 text-[var(--text-muted)]" />
                    )}
                    <span>Theme</span>
                  </div>
                  {/* Toggle Switch */}
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      theme === "dark" ? "bg-blue-600" : "bg-[var(--text-muted)]"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        theme === "dark" ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </button>
              </div>

              {/* Section 4: Upgrade CTA - only for free users */}
              {!isProUser && (
                <div className="border-t border-[var(--border)] px-2 py-2">
                  <button
                    onClick={handleUpgrade}
                    disabled={upgradeLoading}
                    className="flex w-full items-center gap-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2.5 text-sm font-medium text-white transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {upgradeLoading ? "Loading..." : "Upgrade to Pro"}
                  </button>
                </div>
              )}

              {/* Section 5: Log Out */}
              <div className="border-t border-[var(--border)] px-2 py-2">
                <button
                  onClick={handleLogOut}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
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
  );
}
