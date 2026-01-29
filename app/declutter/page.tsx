"use client";

import { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import {
  Inbox,
  Loader2,
  AlertCircle,
  Mail,
  Receipt,
  CreditCard,
  Newspaper,
  Megaphone,
  Bell,
  HelpCircle,
  CheckCircle,
  ExternalLink,
  Sparkles,
  User,
  Brain,
  Trash2,
  Clock,
  AlertTriangle,
  Zap,
  Bomb,
  RotateCcw,
  MessageSquare,
  Link2Off,
  Ban,
  Flag,
  Check,
  X,
  Users,
  ChevronDown,
} from "lucide-react";

type EmailCategory = "important" | "receipts" | "subscriptions" | "newsletters" | "marketing" | "notifications";

interface CategorizedEmail {
  gmail_id: string;
  subject: string;
  from: string;
  from_email: string;
  date: string;
  category: EmailCategory;
  reason: string;
  has_thread: boolean;
  has_unsubscribe: boolean;
  unsubscribe_link: string | null;
}

interface ScanResult {
  sessionId: string;
  emails: CategorizedEmail[];
  counts: {
    important: number;
    receipts: number;
    subscriptions: number;
    newsletters: number;
    marketing: number;
    notifications: number;
  };
  totalUnread: number;
  scannedCount: number;
  hasMore: boolean;
  isComplete: boolean;
  hitMaxLimit: boolean;
  hitTimeLimit: boolean;
  elapsedMs?: number;
}

interface CleanupResult {
  markedRead: number;
  keptUnread: number;
}

interface SenderGroup {
  email: string;
  name: string;
  count: number;
  emails: CategorizedEmail[];
  hasUnsubscribe: boolean;
  unsubscribeLink: string | null;
}

type ScanPhase = "idle" | "fetching" | "analyzing" | "ai" | "done";
type SortOption = "newest" | "oldest" | "sender";
type ViewMode = "emails" | "senders";

const CATEGORY_CONFIG: Record<EmailCategory, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  important: { label: "Important", color: "text-yellow-400", bgColor: "bg-yellow-500/10", icon: AlertCircle },
  receipts: { label: "Receipts", color: "text-emerald-400", bgColor: "bg-emerald-500/10", icon: Receipt },
  subscriptions: { label: "Subscriptions", color: "text-purple-400", bgColor: "bg-purple-500/10", icon: CreditCard },
  newsletters: { label: "Newsletters", color: "text-blue-400", bgColor: "bg-blue-500/10", icon: Newspaper },
  marketing: { label: "Marketing", color: "text-orange-400", bgColor: "bg-orange-500/10", icon: Megaphone },
  notifications: { label: "Notifications", color: "text-zinc-400", bgColor: "bg-zinc-500/10", icon: Bell },
};

export default function DeclutterPage() {
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showNukeConfirm, setShowNukeConfirm] = useState(false);

  // Filter & view state
  const [activeFilter, setActiveFilter] = useState<EmailCategory | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("emails");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [blockedSenders, setBlockedSenders] = useState<Set<string>>(new Set());

  // Action loading states
  const [blockingEmail, setBlockingEmail] = useState<string | null>(null);

  // Mass unsubscribe state
  const [selectedForUnsubscribe, setSelectedForUnsubscribe] = useState<Set<string>>(new Set());
  const [showMassUnsubscribe, setShowMassUnsubscribe] = useState(false);

  // Cumulative scan counter
  const [totalScanned, setTotalScanned] = useState(0);
  const [sessionScanned, setSessionScanned] = useState(0);

  // Mobile category drawer
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);

  const userEmail =
    typeof window !== "undefined"
      ? localStorage.getItem("userEmail") || ""
      : "";

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("declutter_total_scanned");
      if (saved) {
        setTotalScanned(parseInt(saved, 10) || 0);
      }
      const blocked = localStorage.getItem("declutter_blocked_senders");
      if (blocked) {
        setBlockedSenders(new Set(JSON.parse(blocked)));
      }
    }
  }, []);

  // Save cumulative counter
  useEffect(() => {
    if (typeof window !== "undefined" && totalScanned > 0) {
      localStorage.setItem("declutter_total_scanned", totalScanned.toString());
    }
  }, [totalScanned]);

  // Save blocked senders
  useEffect(() => {
    if (typeof window !== "undefined" && blockedSenders.size > 0) {
      localStorage.setItem("declutter_blocked_senders", JSON.stringify([...blockedSenders]));
    }
  }, [blockedSenders]);

  // Filter and sort emails
  const filteredEmails = useMemo(() => {
    if (!scanResult) return [];

    let emails = scanResult.emails;

    if (activeFilter !== "all") {
      emails = emails.filter((e) => e.category === activeFilter);
    }

    emails = [...emails].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortBy === "oldest") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        return a.from_email.localeCompare(b.from_email);
      }
    });

    return emails;
  }, [scanResult, activeFilter, sortBy]);

  // Group emails by sender
  const senderGroups = useMemo(() => {
    if (!scanResult) return [];

    const groups = new Map<string, SenderGroup>();

    for (const email of filteredEmails) {
      const existing = groups.get(email.from_email);
      if (existing) {
        existing.count++;
        existing.emails.push(email);
        if (email.has_unsubscribe && !existing.hasUnsubscribe) {
          existing.hasUnsubscribe = true;
          existing.unsubscribeLink = email.unsubscribe_link;
        }
      } else {
        const nameMatch = email.from.match(/^([^<]+)/);
        const name = nameMatch ? nameMatch[1].trim() : email.from_email;

        groups.set(email.from_email, {
          email: email.from_email,
          name,
          count: 1,
          emails: [email],
          hasUnsubscribe: email.has_unsubscribe,
          unsubscribeLink: email.unsubscribe_link,
        });
      }
    }

    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [filteredEmails, scanResult]);

  // Get senders that have unsubscribe links
  const unsubscribableSenders = useMemo(() => {
    if (!scanResult) return [];

    const groups = new Map<string, SenderGroup>();

    for (const email of scanResult.emails) {
      if (!email.has_unsubscribe || !email.unsubscribe_link) continue;

      const existing = groups.get(email.from_email);
      if (existing) {
        existing.count++;
        existing.emails.push(email);
      } else {
        const nameMatch = email.from.match(/^([^<]+)/);
        const name = nameMatch ? nameMatch[1].trim() : email.from_email;

        groups.set(email.from_email, {
          email: email.from_email,
          name,
          count: 1,
          emails: [email],
          hasUnsubscribe: true,
          unsubscribeLink: email.unsubscribe_link,
        });
      }
    }

    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [scanResult]);

  function resetCounter() {
    setTotalScanned(0);
    setSessionScanned(0);
    if (typeof window !== "undefined") {
      localStorage.removeItem("declutter_total_scanned");
    }
  }

  async function handleScan(scanAll: boolean = false) {
    if (!userEmail) {
      setError("Please sign in first");
      return;
    }

    setScanning(true);
    setScanPhase("fetching");
    setError(null);
    setErrorDetails(null);
    setScanResult(null);
    setCleanupResult(null);
    setSelectedEmails(new Set());
    setActiveFilter("all");

    try {
      const phaseTimer1 = setTimeout(() => setScanPhase("analyzing"), 2000);
      const phaseTimer2 = setTimeout(() => setScanPhase("ai"), scanAll ? 30000 : 5000);

      const res = await fetch("/api/declutter/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, scanAll, maxEmails: 500 }),
      });

      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to scan emails");
      }

      setScanPhase("done");
      setScanResult(data);

      if (data.scannedCount) {
        setSessionScanned(data.scannedCount);
        setTotalScanned((prev) => prev + data.scannedCount);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to scan emails";
      setError(message);
    } finally {
      setScanning(false);
      setScanPhase("idle");
    }
  }

  async function handleCleanup(except: "important" | "none") {
    if (!scanResult?.sessionId) return;

    setCleaning(true);
    setError(null);

    try {
      const res = await fetch("/api/declutter/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail,
          sessionId: scanResult.sessionId,
          except,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to mark emails as read");
      }

      setCleanupResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cleanup");
    } finally {
      setCleaning(false);
    }
  }

  async function handleBlockSender(senderEmail: string, action: "block" | "spam") {
    setBlockingEmail(senderEmail);

    try {
      const res = await fetch("/api/declutter/block-sender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, senderEmail, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to block sender");
      }

      setBlockedSenders((prev) => new Set([...prev, senderEmail]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to block sender");
    } finally {
      setBlockingEmail(null);
    }
  }

  function handleUnsubscribe(link: string | null) {
    if (!link) return;

    if (link.startsWith("mailto:")) {
      window.location.href = link;
    } else {
      window.open(link, "_blank");
    }
  }

  function handleMassUnsubscribe() {
    const links: string[] = [];
    for (const senderEmail of selectedForUnsubscribe) {
      const sender = unsubscribableSenders.find((s) => s.email === senderEmail);
      if (sender?.unsubscribeLink && !sender.unsubscribeLink.startsWith("mailto:")) {
        links.push(sender.unsubscribeLink);
      }
    }

    if (links.length === 0) {
      setError("No unsubscribe links available for selected senders (some may require email unsubscribe)");
      return;
    }

    if (confirm(`This will open ${links.length} unsubscribe pages in new tabs. Continue?`)) {
      for (const link of links) {
        window.open(link, "_blank");
      }
      setSelectedForUnsubscribe(new Set());
      setShowMassUnsubscribe(false);
    }
  }

  function toggleSenderSelection(senderEmail: string) {
    const newSelection = new Set(selectedForUnsubscribe);
    if (newSelection.has(senderEmail)) {
      newSelection.delete(senderEmail);
    } else {
      newSelection.add(senderEmail);
    }
    setSelectedForUnsubscribe(newSelection);
  }

  function selectAllUnsubscribable() {
    const allEmails = new Set(unsubscribableSenders.map(s => s.email));
    setSelectedForUnsubscribe(allEmails);
  }

  function deselectAllUnsubscribable() {
    setSelectedForUnsubscribe(new Set());
  }

  function handleBulkUnsubscribe() {
    const links = new Set<string>();
    for (const gmailId of selectedEmails) {
      const email = scanResult?.emails.find((e) => e.gmail_id === gmailId);
      if (email?.unsubscribe_link && !email.unsubscribe_link.startsWith("mailto:")) {
        links.add(email.unsubscribe_link);
      }
    }

    if (links.size === 0) {
      setError("No unsubscribe links available for selected emails");
      return;
    }

    if (confirm(`This will open ${links.size} unsubscribe pages in new tabs. Continue?`)) {
      for (const link of links) {
        window.open(link, "_blank");
      }
    }
  }

  function toggleSelectEmail(gmailId: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(gmailId)) {
        next.delete(gmailId);
      } else {
        next.add(gmailId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map((e) => e.gmail_id)));
    }
  }

  function openInGmail(gmailId: string) {
    const encodedEmail = encodeURIComponent(userEmail);
    window.open(
      `https://mail.google.com/mail/u/0/?authuser=${encodedEmail}#inbox/${gmailId}`,
      "_blank"
    );
  }

  function getGmailUrl(hash: string = "inbox") {
    const encodedEmail = encodeURIComponent(userEmail);
    return `https://mail.google.com/mail/u/0/?authuser=${encodedEmail}#${hash}`;
  }

  function formatDate(dateStr: string) {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  function getPhaseText(phase: ScanPhase): string {
    switch (phase) {
      case "fetching":
        return "Fetching unread emails...";
      case "analyzing":
        return "Analyzing email headers and categorizing...";
      case "ai":
        return "AI classifying emails into categories...";
      default:
        return "Scanning...";
    }
  }

  function getReasonIcon(reason: string) {
    if (reason === "Known contact") {
      return <User className="h-3.5 w-3.5" />;
    }
    return <Brain className="h-3.5 w-3.5" />;
  }

  // Success state after cleanup
  if (cleanupResult) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="min-h-screen pt-12 pb-20 lg:ml-60 lg:pt-0 lg:pb-0">
          <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4 lg:min-h-screen lg:p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10">
                <CheckCircle className="h-10 w-10 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                Inbox Decluttered!
              </h1>
              <p className="mt-4 text-[var(--text-secondary)]">
                Marked <span className="font-semibold text-emerald-400">{cleanupResult.markedRead.toLocaleString()}</span> emails as read.
                <br />
                Kept <span className="font-semibold text-yellow-400">{cleanupResult.keptUnread}</span> important emails unread.
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <a
                  href={getGmailUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                >
                  <ExternalLink className="h-5 w-5" />
                  Open Gmail
                </a>
                <button
                  onClick={() => {
                    setCleanupResult(null);
                    setScanResult(null);
                  }}
                  className="min-h-[44px] rounded-xl border border-[var(--border)] px-6 py-3 font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  Scan Again
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      <main className="min-h-screen pt-12 pb-20 lg:ml-60 lg:pt-0 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8 lg:pb-24">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
              Declutter Your Inbox
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)] sm:mt-2 sm:text-base">
              Scan your unread emails, find what&apos;s important, and clear the rest
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
                <span className="text-sm text-red-300">{error}</span>
              </div>
              {errorDetails && (
                <pre className="mt-3 max-h-32 overflow-auto rounded bg-red-900/20 p-2 text-xs text-red-300">
                  {errorDetails}
                </pre>
              )}
              <button
                onClick={() => {
                  setError(null);
                  setErrorDetails(null);
                }}
                className="mt-3 text-sm text-red-400 hover:text-red-300"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Initial State - Scan Buttons */}
          {!scanResult && !scanning && (
            <div className="flex flex-col items-center justify-center py-12 lg:py-16">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 sm:h-24 sm:w-24">
                <Inbox className="h-10 w-10 text-blue-400 sm:h-12 sm:w-12" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
                Ready to declutter?
              </h2>
              <p className="mt-2 max-w-md px-4 text-center text-sm text-[var(--text-secondary)] sm:text-base">
                We&apos;ll scan your unread emails, classify them into categories using AI,
                and help you reach inbox zero fast.
              </p>

              {/* Scan buttons - stack on mobile, row on desktop */}
              <div className="mt-8 flex w-full max-w-md flex-col gap-3 px-4 sm:flex-row sm:gap-4 sm:px-0">
                <button
                  onClick={() => handleScan(false)}
                  className="flex min-h-[52px] flex-1 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-400 hover:to-cyan-400"
                >
                  <Sparkles className="h-5 w-5" />
                  <span>Quick Scan</span>
                </button>

                <button
                  onClick={() => handleScan(true)}
                  className="group flex min-h-[52px] flex-1 items-center justify-center gap-3 rounded-xl border-2 border-orange-500/50 bg-orange-500/10 px-6 py-4 font-semibold text-orange-400 transition-all hover:border-orange-500 hover:bg-orange-500/20"
                >
                  <Zap className="h-5 w-5" />
                  <span>Deep Scan</span>
                </button>
              </div>

              {/* Category preview - 2 columns on mobile, 3 on larger */}
              <div className="mt-8 grid grid-cols-2 gap-2 px-4 text-xs sm:grid-cols-3 sm:gap-3 sm:px-0">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <div key={key} className={`flex items-center gap-2 ${config.color}`}>
                    <config.icon className="h-4 w-4" />
                    <span>{config.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scanning State */}
          {scanning && (
            <div className="flex flex-col items-center justify-center py-16 lg:py-20">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl" />
                <Loader2 className="relative h-12 w-12 animate-spin text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
                Scanning your inbox...
              </h2>
              <p className="mt-2 text-center text-sm text-[var(--text-secondary)] sm:text-base">
                {getPhaseText(scanPhase)}
              </p>
              <div className="mt-6 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full transition-colors ${scanPhase === "fetching" ? "bg-blue-500" : "bg-[var(--border)]"}`} />
                <div className={`h-2 w-2 rounded-full transition-colors ${scanPhase === "analyzing" ? "bg-blue-500" : "bg-[var(--border)]"}`} />
                <div className={`h-2 w-2 rounded-full transition-colors ${scanPhase === "ai" ? "bg-blue-500" : "bg-[var(--border)]"}`} />
              </div>
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                <Clock className="mr-1 inline h-3 w-3" />
                This may take up to 2 minutes for large inboxes
              </p>
            </div>
          )}

          {/* Results State */}
          {scanResult && (
            <div className="space-y-4 sm:space-y-6">
              {/* Cumulative Scan Counter */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[var(--text-muted)] sm:h-5 sm:w-5" />
                      <span className="text-xs text-[var(--text-secondary)] sm:text-sm">
                        Total Scanned:{" "}
                        <strong className="text-[var(--text-primary)]">{totalScanned.toLocaleString()}</strong>
                      </span>
                    </div>
                    <span className="hidden text-[var(--border)] sm:inline">|</span>
                    <span className="text-xs text-[var(--text-muted)] sm:text-sm">
                      This session: <strong>{sessionScanned.toLocaleString()}</strong>
                    </span>
                  </div>
                  <button
                    onClick={resetCounter}
                    className="flex items-center gap-1 self-start text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                </div>
              </div>

              {/* Clickable Category Stats - Mobile: 2 cols, Tablet: 3 cols, Desktop: 6 cols */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                  const category = key as EmailCategory;
                  const count = scanResult.counts[category];
                  const isActive = activeFilter === category;
                  const Icon = config.icon;

                  return (
                    <button
                      key={key}
                      onClick={() => setActiveFilter(isActive ? "all" : category)}
                      className={`glass-card p-3 text-left transition-all sm:p-4 ${
                        isActive
                          ? `ring-2 ring-offset-2 ring-offset-[var(--bg-primary)] ${config.color.replace("text-", "ring-")}`
                          : "hover:bg-[var(--bg-elevated)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl ${config.bgColor}`}>
                          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${config.color}`} />
                        </div>
                        <div>
                          <p className={`text-lg font-bold sm:text-xl ${isActive ? config.color : "text-[var(--text-primary)]"}`}>
                            {count.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] sm:text-xs">{config.label}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Filter Pills & Controls - Horizontally scrollable on mobile */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
                  <div className="flex items-center gap-2 pb-2 sm:flex-wrap sm:pb-0">
                    <button
                      onClick={() => setActiveFilter("all")}
                      className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                        activeFilter === "all"
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
                      }`}
                    >
                      All ({scanResult.scannedCount})
                    </button>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                      const category = key as EmailCategory;
                      const count = scanResult.counts[category];
                      return (
                        <button
                          key={key}
                          onClick={() => setActiveFilter(category)}
                          className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                            activeFilter === category
                              ? `${config.bgColor} ${config.color}`
                              : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
                          }`}
                        >
                          {config.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex rounded-lg border border-[var(--border)] p-0.5">
                    <button
                      onClick={() => setViewMode("emails")}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                        viewMode === "emails"
                          ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Emails</span>
                    </button>
                    <button
                      onClick={() => setViewMode("senders")}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 ${
                        viewMode === "senders"
                          ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Senders</span>
                    </button>
                  </div>

                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-[var(--text-primary)] sm:px-3 sm:text-sm"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="sender">Sender</option>
                  </select>
                </div>
              </div>

              {/* Email List View */}
              {viewMode === "emails" && (
                <div className="glass-card overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-3 sm:px-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedEmails.size === filteredEmails.length && filteredEmails.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-elevated)]"
                      />
                      <span className="text-xs text-[var(--text-muted)] sm:text-sm">
                        {filteredEmails.length} emails
                      </span>
                    </div>
                  </div>

                  {/* Email Rows */}
                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border)] sm:max-h-[500px]">
                    {filteredEmails.map((email) => {
                      const config = CATEGORY_CONFIG[email.category];
                      const isBlocked = blockedSenders.has(email.from_email);

                      return (
                        <div
                          key={email.gmail_id}
                          className={`group flex items-start gap-3 px-3 py-3 transition-colors hover:bg-[var(--bg-elevated)] sm:items-center sm:gap-4 sm:px-4 ${
                            isBlocked ? "opacity-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(email.gmail_id)}
                            onChange={() => toggleSelectEmail(email.gmail_id)}
                            className="mt-1 h-4 w-4 flex-shrink-0 rounded border-[var(--border)] bg-[var(--bg-elevated)] sm:mt-0"
                          />

                          <div className="min-w-0 flex-1">
                            {/* Mobile: Stacked layout */}
                            <div className="sm:hidden">
                              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                                {email.subject}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                                <span className="truncate">{email.from}</span>
                                <span>·</span>
                                <span className="flex-shrink-0">{formatDate(email.date)}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`rounded px-1.5 py-0.5 text-xs ${config.bgColor} ${config.color}`}>
                                  {config.label}
                                </span>
                                {email.has_thread && (
                                  <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                                )}
                                {isBlocked && (
                                  <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-400">
                                    Blocked
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Desktop: Inline layout */}
                            <div className="hidden sm:block">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-medium text-[var(--text-primary)]">
                                  {email.subject}
                                </p>
                                {email.has_thread && (
                                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
                                )}
                                <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs ${config.bgColor} ${config.color}`}>
                                  {config.label}
                                </span>
                                {isBlocked && (
                                  <span className="flex-shrink-0 rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-400">
                                    Blocked
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                                <span className="truncate">{email.from}</span>
                                <span>·</span>
                                <span className="flex-shrink-0">{formatDate(email.date)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons - Always visible on mobile, hover on desktop */}
                          <div className="flex flex-shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                            {email.has_unsubscribe && (
                              <button
                                onClick={() => handleUnsubscribe(email.unsubscribe_link)}
                                className="rounded-lg p-2 text-orange-400 transition-colors hover:bg-orange-500/10"
                                title={email.unsubscribe_link?.startsWith("mailto:") ? "Unsubscribe via email" : "Unsubscribe"}
                              >
                                <Link2Off className="h-4 w-4" />
                              </button>
                            )}
                            {!isBlocked && (
                              <button
                                onClick={() => handleBlockSender(email.from_email, "block")}
                                disabled={blockingEmail === email.from_email}
                                className="hidden rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50 sm:block"
                                title="Block sender"
                              >
                                {blockingEmail === email.from_email ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Ban className="h-4 w-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => openInGmail(email.gmail_id)}
                              className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                              title="Open in Gmail"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sender Group View */}
              {viewMode === "senders" && (
                <div className="glass-card overflow-hidden">
                  <div className="border-b border-[var(--border)] px-3 py-3 sm:px-4">
                    <span className="text-xs text-[var(--text-muted)] sm:text-sm">
                      {senderGroups.length} unique senders
                    </span>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--border)] sm:max-h-[500px]">
                    {senderGroups.map((sender) => {
                      const isBlocked = blockedSenders.has(sender.email);

                      return (
                        <div
                          key={sender.email}
                          className={`group flex flex-col gap-3 px-3 py-3 transition-colors hover:bg-[var(--bg-elevated)] sm:flex-row sm:items-center sm:justify-between sm:px-4 ${
                            isBlocked ? "opacity-50" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-[var(--text-primary)]">
                                {sender.name}
                              </p>
                              <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                                {sender.count} emails
                              </span>
                              {isBlocked && (
                                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-400">
                                  Blocked
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
                              {sender.email}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {sender.hasUnsubscribe && (
                              <button
                                onClick={() => handleUnsubscribe(sender.unsubscribeLink)}
                                className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-orange-500/50 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
                              >
                                <Link2Off className="h-3.5 w-3.5" />
                                Unsubscribe
                              </button>
                            )}
                            {!isBlocked && (
                              <button
                                onClick={() => handleBlockSender(sender.email, "block")}
                                disabled={blockingEmail === sender.email}
                                className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                              >
                                {blockingEmail === sender.email ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Ban className="h-3.5 w-3.5" />
                                )}
                                Block
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mass Unsubscribe Section */}
              {unsubscribableSenders.length > 0 && (
                <div className="glass-card overflow-hidden">
                  <button
                    onClick={() => setShowMassUnsubscribe(!showMassUnsubscribe)}
                    className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                        <Link2Off className="h-5 w-5 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)]">Mass Unsubscribe</h3>
                        <p className="text-sm text-[var(--text-muted)]">
                          {unsubscribableSenders.length} subscriptions found
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-[var(--text-muted)] transition-transform ${
                        showMassUnsubscribe ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showMassUnsubscribe && (
                    <div className="border-t border-[var(--border)]">
                      {/* Select All / Deselect All */}
                      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                        <span className="text-sm text-[var(--text-muted)]">
                          {selectedForUnsubscribe.size} of {unsubscribableSenders.length} selected
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={selectAllUnsubscribable}
                            className="text-sm font-medium text-[var(--accent)] hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-[var(--border)]">|</span>
                          <button
                            onClick={deselectAllUnsubscribable}
                            className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      {/* Subscription List */}
                      <div className="max-h-[400px] divide-y divide-[var(--border)] overflow-y-auto">
                        {unsubscribableSenders.map((sender) => {
                          const isSelected = selectedForUnsubscribe.has(sender.email);
                          const isMailto = sender.unsubscribeLink?.startsWith("mailto:");

                          return (
                            <div
                              key={sender.email}
                              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                isSelected ? "bg-orange-500/5" : "hover:bg-[var(--bg-elevated)]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSenderSelection(sender.email)}
                                disabled={isMailto}
                                className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-elevated)] text-orange-500 focus:ring-orange-500/50 disabled:opacity-50"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-[var(--text-primary)]">
                                  {sender.name}
                                </p>
                                <p className="truncate text-sm text-[var(--text-muted)]">
                                  {sender.email} • {sender.count} email{sender.count > 1 ? "s" : ""}
                                </p>
                              </div>
                              {isMailto && (
                                <span className="rounded bg-zinc-500/10 px-2 py-0.5 text-xs text-zinc-400">
                                  Email only
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Unsubscribe Button */}
                      <div className="border-t border-[var(--border)] px-4 py-4">
                        <button
                          onClick={handleMassUnsubscribe}
                          disabled={selectedForUnsubscribe.size === 0}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Link2Off className="h-5 w-5" />
                          Unsubscribe from {selectedForUnsubscribe.size} Subscription{selectedForUnsubscribe.size !== 1 ? "s" : ""}
                        </button>
                        <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
                          This will open unsubscribe pages in new tabs. Some may require confirmation.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="glass-card p-4 sm:p-6">
                <h3 className="mb-4 font-semibold text-[var(--text-primary)]">
                  Ready to clean up?
                </h3>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    onClick={() => handleCleanup("important")}
                    disabled={cleaning}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                  >
                    {cleaning ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Trash2 className="h-5 w-5" />
                    )}
                    <span className="text-sm sm:text-base">Mark All Read Except Important</span>
                  </button>

                  <a
                    href={getGmailUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-6 py-3 font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  >
                    <ExternalLink className="h-5 w-5" />
                    Review in Gmail First
                  </a>
                </div>

                {/* Nuke Button */}
                <div className="mt-6 border-t border-[var(--border)] pt-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <button
                      onClick={() => setShowNukeConfirm(true)}
                      disabled={cleaning}
                      className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-red-500/50 bg-red-500/10 px-6 py-3 font-semibold text-red-400 transition-all hover:border-red-500 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <Bomb className="h-5 w-5" />
                      Mark ALL as Read
                    </button>
                    <span className="text-center text-xs text-[var(--text-muted)] sm:text-left sm:text-sm">
                      Including important emails
                    </span>
                  </div>
                </div>

                {/* Nuke Confirmation Modal - Bottom sheet on mobile */}
                {showNukeConfirm && (
                  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
                    <div className="mx-0 w-full rounded-t-2xl border-t border-red-500/30 bg-[var(--bg-card)] p-6 shadow-2xl sm:mx-4 sm:max-w-md sm:rounded-2xl sm:border">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                        Mark ALL Emails as Read?
                      </h3>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        This will mark <strong className="text-red-400">{scanResult.scannedCount.toLocaleString()}</strong> scanned emails as read,{" "}
                        <strong className="text-red-400">including important ones</strong>.
                      </p>
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button
                          onClick={() => setShowNukeConfirm(false)}
                          className="min-h-[44px] flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            setShowNukeConfirm(false);
                            handleCleanup("none");
                          }}
                          disabled={cleaning}
                          className="min-h-[44px] flex-1 rounded-xl bg-red-500 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                        >
                          Yes, Mark All Read
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <p className="mt-4 text-xs text-[var(--text-muted)] sm:text-sm">
                  <HelpCircle className="mr-1 inline h-4 w-4" />
                  This will mark emails as read, not delete them. You can always find them in Gmail.
                </p>
              </div>

              {/* Scan Again Options */}
              <div className="flex items-center justify-center gap-4 pb-4">
                <button
                  onClick={() => handleScan(false)}
                  disabled={scanning}
                  className="min-h-[44px] text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  Quick Scan Again
                </button>
                <span className="text-[var(--border)]">|</span>
                <button
                  onClick={() => handleScan(true)}
                  disabled={scanning}
                  className="min-h-[44px] text-sm text-orange-400 transition-colors hover:text-orange-300"
                >
                  Deep Scan Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Action Bar - Fixed at bottom */}
        {selectedEmails.size > 0 && (
          <div className="fixed bottom-20 left-0 right-0 z-30 px-4 lg:bottom-6 lg:left-60 lg:px-0">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shadow-2xl sm:justify-center sm:gap-3 sm:px-6">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {selectedEmails.size} selected
              </span>
              <div className="hidden h-4 w-px bg-[var(--border)] sm:block" />
              <button
                onClick={handleBulkUnsubscribe}
                className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/10"
              >
                <Link2Off className="h-4 w-4" />
                <span className="hidden sm:inline">Unsubscribe</span>
              </button>
              <button
                onClick={() => setSelectedEmails(new Set())}
                className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
