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
  Sparkles,
  ChevronUp,
  MessageSquare,
  Inbox,
  Menu,
  X,
} from "lucide-react";
import Logo from "./Logo";
import SupportChat from "./SupportChat";
import { useAuth } from "@/lib/useAuth";

// Clean nav - just the core items
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/declutter", label: "Declutter", icon: Inbox },
  { href: "/categorize", label: "Categorize", icon: Tag },
  { href: "/drafts", label: "Drafts", icon: Mail },
];

// Bottom nav items (subset for mobile)
const bottomNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/declutter", label: "Declutter", icon: Inbox },
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

  // Use the auth hook to get session data
  const { userEmail: authEmail, userName: authName, userPicture: authPicture, isAuthenticated } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<Role>("user");

  // Hydrate from localStorage on client mount
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    if (userEmail) {
      setUser({
        email: userEmail,
        name: localStorage.getItem("userName") || userEmail.split("@")[0],
        picture: localStorage.getItem("userPicture") || undefined,
        subscriptionStatus: localStorage.getItem("subscriptionStatus") || undefined,
      });
    }
    setIsAdmin(localStorage.getItem("isAdmin") === "true");
    setUserRole((localStorage.getItem("userRole") as Role) || "user");
  }, []);

  // Update user state when auth session changes
  useEffect(() => {
    if (authEmail && isAuthenticated) {
      setUser(prev => ({
        ...prev,
        email: authEmail,
        name: authName || authEmail.split("@")[0],
        picture: authPicture || undefined,
        subscriptionStatus: prev?.subscriptionStatus,
      }));
    }
  }, [authEmail, authName, authPicture, isAuthenticated]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Hydrate theme from localStorage on client mount
  useEffect(() => {
    setTheme((localStorage.getItem("theme") as "dark" | "light") || "dark");
  }, []);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

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

  // Sync theme state with actual DOM on mount
  useEffect(() => {
    const actualTheme = document.documentElement.getAttribute("data-theme") as "dark" | "light";
    if (actualTheme && actualTheme !== theme) {
      setTheme(actualTheme);
    }
  }, []);

  // Fetch settings when we have a user email (either from auth or localStorage)
  useEffect(() => {
    const emailToUse = authEmail || localStorage.getItem("userEmail");

    if (emailToUse) {
      fetch(`/api/settings?userEmail=${emailToUse}`)
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
  }, [authEmail]);

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

    // Disable transitions during theme change for instant switch
    document.documentElement.classList.add("theme-transitioning");

    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);

    // Re-enable transitions after a brief delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("theme-transitioning");
      });
    });
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
    <>
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="sidebar-bg fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col overflow-y-auto border-r border-[var(--border)] lg:flex">
        {/* Logo */}
        <div className="flex items-center pl-[26px] pr-6 pt-[22px] pb-5 mb-4">
          <Logo />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
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
                  <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                    {isProUser ? (
                      <>
                        <Sparkles className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-400">Pro Plan</span>
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 text-[var(--text-muted)]" />
                        <span className="text-sm text-[var(--text-primary)]">Free Plan</span>
                      </>
                    )}
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

                  {/* Talk to Support */}
                  <button
                    onClick={() => { setMenuOpen(false); setChatOpen(true); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <MessageSquare className="h-4 w-4 text-[var(--text-muted)]" />
                    Talk to Support
                  </button>

                  {/* Theme Toggle */}
                  <div className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]">
                    <div className="flex items-center gap-3">
                      {theme === "dark" ? (
                        <Moon className="h-4 w-4 text-[var(--text-muted)]" />
                      ) : (
                        <Sun className="h-4 w-4 text-[var(--text-muted)]" />
                      )}
                      <span>Theme</span>
                    </div>
                    {/* Toggle Switch - only this is clickable */}
                    <button
                      onClick={toggleTheme}
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        theme === "dark" ? "bg-blue-600" : "bg-[var(--text-muted)]"
                      }`}
                      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                          theme === "dark" ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
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

      {/* Mobile Top Header */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-primary)] px-4 lg:hidden">
        <Logo />
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--bg-primary)] pb-safe lg:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-lg px-3 py-1 transition-colors ${
                  isActive
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-[var(--accent)]" : ""}`} />
                <span className="mt-1 text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel - Slide in from right */}
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-[var(--bg-primary)] shadow-2xl">
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
              <span className="font-semibold text-[var(--text-primary)]">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Info */}
            {user && (
              <div className="border-b border-[var(--border)] p-4">
                <div className="flex items-center gap-3">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="h-12 w-12 rounded-full"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-semibold text-white">
                      {getInitials(user.name)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{user.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {userRole !== "user" ? (
                    getRoleBadge()
                  ) : isProUser ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                      <Sparkles className="h-3 w-3" />
                      PRO
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">Free Plan</span>
                  )}
                </div>
              </div>
            )}

            {/* Menu Links */}
            <div className="p-4">
              <div className="space-y-1">
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <Settings className="h-5 w-5 text-[var(--text-muted)]" />
                  Settings
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <Shield className="h-5 w-5 text-[var(--text-muted)]" />
                    Admin
                  </Link>
                )}

                <Link
                  href="/analytics"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <BarChart3 className="h-5 w-5 text-[var(--text-muted)]" />
                  Analytics
                </Link>

                <button
                  onClick={() => { setMobileMenuOpen(false); setChatOpen(true); }}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <MessageSquare className="h-5 w-5 text-[var(--text-muted)]" />
                  Talk to Support
                </button>
              </div>

              {/* Theme Toggle */}
              <div className="mt-4 flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon className="h-5 w-5 text-[var(--text-muted)]" />
                  ) : (
                    <Sun className="h-5 w-5 text-[var(--text-muted)]" />
                  )}
                  <span className="text-[var(--text-primary)]">Dark Mode</span>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    theme === "dark" ? "bg-blue-600" : "bg-[var(--text-muted)]"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      theme === "dark" ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Upgrade CTA - only for free users */}
              {!isProUser && (
                <button
                  onClick={() => {
                    handleUpgrade();
                    setMobileMenuOpen(false);
                  }}
                  disabled={upgradeLoading}
                  className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-medium text-white transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
                >
                  <Sparkles className="h-5 w-5" />
                  {upgradeLoading ? "Loading..." : "Upgrade to Pro"}
                </button>
              )}

              {/* Logout */}
              <button
                onClick={handleLogOut}
                className="mt-4 flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-red-400 transition-colors hover:bg-red-500/10"
              >
                <LogOut className="h-5 w-5" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Chat Widget */}
      <SupportChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
