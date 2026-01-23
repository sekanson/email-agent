"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Tag, Mail, LogOut } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Categorize", icon: Tag },
  { href: "/drafts", label: "Drafts", icon: Mail },
];

interface User {
  email: string;
  name: string;
  picture?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    const userName = localStorage.getItem("userName");
    const userPicture = localStorage.getItem("userPicture");

    if (userEmail) {
      setUser({
        email: userEmail,
        name: userName || userEmail.split("@")[0],
        picture: userPicture || undefined,
      });
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

  const handleSignOut = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("userPicture");
    window.location.href = "/";
  };

  return (
    <aside className="sidebar-bg flex h-screen w-64 flex-col border-r border-[var(--border)]">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
        <Logo size="md" />
        <ThemeToggle />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
        <div className="mb-2 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Menu
          </span>
        </div>
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
                      ? "bg-[var(--accent-muted)] text-[var(--accent)] shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${
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

      {/* User Info */}
      <div className="border-t border-[var(--border)] p-4">
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
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-semibold text-white">
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
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
            >
              <LogOut className="h-3.5 w-3.5" />
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
    </aside>
  );
}
