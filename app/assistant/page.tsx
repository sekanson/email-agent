"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import {
  Loader2,
  Mail,
  Bell,
  BellOff,
  Clock,
  Star,
  Plus,
  X,
  Moon,
  Sun,
  Calendar,
  AlertTriangle,
  Check,
  Sparkles,
  Send,
  Settings,
  MessageSquare,
} from "lucide-react";

interface ZenoSettings {
  zeno_digest_enabled: boolean;
  zeno_digest_types: string[];
  zeno_morning_time: string;
  zeno_eod_time: string;
  vip_senders: string[];
  focus_mode_enabled: boolean;
  focus_mode_until: string | null;
  timezone: string;
  zeno_confirmations?: boolean;
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (EST/EDT)" },
  { value: "America/Chicago", label: "Central (CST/CDT)" },
  { value: "America/Denver", label: "Mountain (MST/MDT)" },
  { value: "America/Los_Angeles", label: "Pacific (PST/PDT)" },
  { value: "America/Toronto", label: "Toronto (EST/EDT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

const FOCUS_DURATIONS = [
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "today", label: "Until end of day" },
  { value: "tomorrow", label: "Until tomorrow" },
  { value: "week", label: "1 week" },
  { value: "custom", label: "Custom date..." },
];

export default function AssistantPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newVip, setNewVip] = useState("");
  const [showFocusOptions, setShowFocusOptions] = useState(false);
  const [showCustomTimes, setShowCustomTimes] = useState(false);

  // Auto-dismiss toast messages after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const [settings, setSettings] = useState<ZenoSettings>({
    zeno_digest_enabled: true,
    zeno_digest_types: ["morning", "eod", "weekly"],
    zeno_morning_time: "09:00",
    zeno_eod_time: "18:00",
    vip_senders: [],
    focus_mode_enabled: false,
    focus_mode_until: null,
    timezone: "America/New_York",
  });

  const userEmail = typeof window !== "undefined" ? localStorage.getItem("userEmail") || "" : "";
  const userName = typeof window !== "undefined" ? localStorage.getItem("userName") || "" : "";

  useEffect(() => {
    if (userEmail) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [userEmail]);

  async function fetchSettings() {
    try {
      const res = await fetch(`/api/settings?userEmail=${userEmail}`);
      const data = await res.json();

      if (data.settings) {
        setSettings({
          zeno_digest_enabled: data.settings.zeno_digest_enabled ?? true,
          zeno_digest_types: data.settings.zeno_digest_types || ["morning", "eod", "weekly"],
          zeno_morning_time: data.settings.zeno_morning_time || "09:00",
          zeno_eod_time: data.settings.zeno_eod_time || "18:00",
          vip_senders: data.settings.vip_senders || [],
          focus_mode_enabled: data.settings.focus_mode_enabled || false,
          focus_mode_until: data.settings.focus_mode_until || null,
          timezone: data.settings.timezone || "America/New_York",
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(settingsToSave?: Partial<ZenoSettings>, silent = false) {
    if (!silent) setSaving(true);
    if (!silent) setMessage(null);

    const finalSettings = settingsToSave ? { ...settings, ...settingsToSave } : settings;

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, settings: finalSettings }),
      });

      if (res.ok) {
        if (!silent) setMessage({ type: "success", text: "Settings saved!" });
        return true;
      } else {
        if (!silent) setMessage({ type: "error", text: "Failed to save settings" });
        return false;
      }
    } catch (error) {
      if (!silent) setMessage({ type: "error", text: "Failed to save settings" });
      return false;
    } finally {
      if (!silent) setSaving(false);
    }
  }

  async function sendTestDigest() {
    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/zeno-agent/send-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, digestType: "morning" }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: "success", text: `Test digest sent! Check your inbox.` });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to send test" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to send test digest" });
    } finally {
      setTesting(false);
    }
  }


  async function addVipSender() {
    if (!newVip.trim()) return;
    const email = newVip.trim().toLowerCase();
    if (!settings.vip_senders.includes(email)) {
      const newVipList = [...settings.vip_senders, email];
      setSettings((prev) => ({
        ...prev,
        vip_senders: newVipList,
      }));
      // Auto-save VIP changes
      const saved = await saveSettings({ vip_senders: newVipList }, true);
      if (saved) {
        setMessage({ type: "success", text: `${email} added to VIP list` });
      } else {
        setMessage({ type: "error", text: "Failed to save VIP sender" });
        // Revert the change
        setSettings((prev) => ({
          ...prev,
          vip_senders: settings.vip_senders,
        }));
      }
    }
    setNewVip("");
  }

  async function removeVipSender(emailToRemove: string) {
    const previousList = settings.vip_senders;
    const newVipList = settings.vip_senders.filter((e) => e !== emailToRemove);
    setSettings((prev) => ({
      ...prev,
      vip_senders: newVipList,
    }));
    // Auto-save VIP changes
    const saved = await saveSettings({ vip_senders: newVipList }, true);
    if (!saved) {
      setMessage({ type: "error", text: "Failed to save settings" });
      // Revert the change
      setSettings((prev) => ({
        ...prev,
        vip_senders: previousList,
      }));
    }
  }

  async function enableFocusMode(duration: string) {
    let until: string | null = null;
    const now = new Date();

    switch (duration) {
      case "1h":
        until = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
        break;
      case "4h":
        until = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
        break;
      case "today":
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        until = endOfDay.toISOString();
        break;
      case "tomorrow":
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        until = tomorrow.toISOString();
        break;
      case "week":
        until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
    }

    setSettings((prev) => ({
      ...prev,
      focus_mode_enabled: true,
      focus_mode_until: until,
    }));
    setShowFocusOptions(false);

    // Auto-save focus mode immediately
    const saved = await saveSettings({ focus_mode_enabled: true, focus_mode_until: until }, true);
    if (saved) {
      setMessage({ type: "success", text: `Focus mode enabled until ${new Date(until!).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` });
    } else {
      setMessage({ type: "error", text: "Failed to save focus mode settings" });
      // Revert the state change
      setSettings((prev) => ({
        ...prev,
        focus_mode_enabled: false,
        focus_mode_until: null,
      }));
    }
  }

  async function disableFocusMode() {
    const previousEnabled = settings.focus_mode_enabled;
    const previousUntil = settings.focus_mode_until;

    setSettings((prev) => ({
      ...prev,
      focus_mode_enabled: false,
      focus_mode_until: null,
    }));

    // Auto-save focus mode immediately
    const saved = await saveSettings({ focus_mode_enabled: false, focus_mode_until: null }, true);
    if (saved) {
      setMessage({ type: "success", text: "Focus mode disabled" });
    } else {
      setMessage({ type: "error", text: "Failed to save settings" });
      // Revert the state change
      setSettings((prev) => ({
        ...prev,
        focus_mode_enabled: previousEnabled,
        focus_mode_until: previousUntil,
      }));
    }
  }

  const focusModeActive = settings.focus_mode_enabled && 
    (!settings.focus_mode_until || new Date(settings.focus_mode_until) > new Date());

  const focusModeEndTime = settings.focus_mode_until 
    ? new Date(settings.focus_mode_until).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex min-h-screen items-center justify-center pb-20 pt-12 lg:ml-60 lg:pb-0 lg:pt-0">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex min-h-screen items-center justify-center px-4 pb-20 pt-12 lg:ml-60 lg:pb-0 lg:pt-0">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Not signed in</h2>
            <p className="mt-2 text-[var(--text-muted)]">Please sign in to access Zeno Assistant settings.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      <main className="min-h-screen overflow-auto pb-20 pt-12 lg:ml-60 lg:pb-0 lg:pt-0">
        {/* Header */}
        <div className="border-b border-[var(--border)] bg-[var(--bg-primary)] px-4 py-4 sm:px-8 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">Zeno - Your Email Assistant</h1>
              <p className="text-sm text-[var(--text-muted)]">Meet your new AI email companion</p>
            </div>
          </div>
        </div>

        {/* Fixed Toast Notification */}
        {message && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm shadow-lg ${
                message.type === "success"
                  ? "bg-emerald-500 text-white"
                  : "bg-red-500 text-white"
              }`}
            >
              {message.type === "success" ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              {message.text}
            </div>
          </div>
        )}

        <div className="p-4 sm:p-8">

          <div className="max-w-2xl space-y-6">
            {/* Focus Mode Card */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {focusModeActive ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
                      <Moon className="h-6 w-6 text-purple-400" />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-elevated)]">
                      <Sun className="h-6 w-6 text-amber-400" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Focus Mode</h2>
                    <p className="text-sm text-[var(--text-muted)]">
                      {focusModeActive
                        ? `Active until ${focusModeEndTime || "you turn it off"}`
                        : "Pause non-urgent notifications"}
                    </p>
                  </div>
                </div>
                
                {focusModeActive ? (
                  <button
                    onClick={disableFocusMode}
                    className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600"
                  >
                    Turn Off
                  </button>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setShowFocusOptions(!showFocusOptions)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)]"
                    >
                      Enable
                    </button>
                    {showFocusOptions && (
                      <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-lg">
                        {FOCUS_DURATIONS.filter(d => d.value !== "custom").map((duration) => (
                          <button
                            key={duration.value}
                            onClick={() => enableFocusMode(duration.value)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                          >
                            {duration.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {focusModeActive && (
                <div className="mt-4 rounded-lg bg-purple-500/10 p-3 text-sm text-purple-300">
                  <p>🧘 You'll only receive <strong>urgent alerts</strong> (VIP senders, deadlines).</p>
                  <p className="mt-1 text-purple-400">Regular digests are paused.</p>
                </div>
              )}
            </section>

            {/* Email Digests */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
                    <Mail className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Email Digests</h2>
                    <p className="text-sm text-[var(--text-muted)]">When should Zeno send you summaries?</p>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.zeno_digest_enabled}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      setSettings({ ...settings, zeno_digest_enabled: newValue });
                      await saveSettings({ zeno_digest_enabled: newValue }, true);
                    }}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-[var(--bg-elevated)] peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500/20 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              {settings.zeno_digest_enabled && (
                <div className="space-y-3">
                  {/* Morning Brief */}
                  <div
                    onClick={async () => {
                      const newTypes = settings.zeno_digest_types.includes("morning")
                        ? settings.zeno_digest_types.filter((t) => t !== "morning")
                        : [...settings.zeno_digest_types, "morning"];
                      setSettings({ ...settings, zeno_digest_types: newTypes });
                      await saveSettings({ zeno_digest_types: newTypes }, true);
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all ${
                      settings.zeno_digest_types.includes("morning")
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-[var(--border)] bg-[var(--bg-elevated)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🌅</span>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Morning Brief</p>
                        <p className="text-sm text-[var(--text-muted)]">Start your day with what needs attention</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">{settings.zeno_morning_time || "9:00 AM"}</span>
                      {settings.zeno_digest_types.includes("morning") && (
                        <Check className="h-5 w-5 text-blue-400" />
                      )}
                    </div>
                  </div>

                  {/* EOD Wrap-up */}
                  <div
                    onClick={async () => {
                      const newTypes = settings.zeno_digest_types.includes("eod")
                        ? settings.zeno_digest_types.filter((t) => t !== "eod")
                        : [...settings.zeno_digest_types, "eod"];
                      setSettings({ ...settings, zeno_digest_types: newTypes });
                      await saveSettings({ zeno_digest_types: newTypes }, true);
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all ${
                      settings.zeno_digest_types.includes("eod")
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-[var(--border)] bg-[var(--bg-elevated)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🌙</span>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">End of Day</p>
                        <p className="text-sm text-[var(--text-muted)]">Wrap up and catch anything missed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">{settings.zeno_eod_time || "6:00 PM"}</span>
                      {settings.zeno_digest_types.includes("eod") && (
                        <Check className="h-5 w-5 text-blue-400" />
                      )}
                    </div>
                  </div>

                  {/* Weekly Digest */}
                  <div
                    onClick={async () => {
                      const newTypes = settings.zeno_digest_types.includes("weekly")
                        ? settings.zeno_digest_types.filter((t) => t !== "weekly")
                        : [...settings.zeno_digest_types, "weekly"];
                      setSettings({ ...settings, zeno_digest_types: newTypes });
                      await saveSettings({ zeno_digest_types: newTypes }, true);
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all ${
                      settings.zeno_digest_types.includes("weekly")
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-[var(--border)] bg-[var(--bg-elevated)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📊</span>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Weekly Digest</p>
                        <p className="text-sm text-[var(--text-muted)]">Review your week every Monday</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">Mon 9 AM</span>
                      {settings.zeno_digest_types.includes("weekly") && (
                        <Check className="h-5 w-5 text-blue-400" />
                      )}
                    </div>
                  </div>

                  {/* Urgent Alerts - Always on */}
                  <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🚨</span>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">Urgent Alerts</p>
                        <p className="text-sm text-[var(--text-muted)]">VIP senders & time-sensitive emails</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400">
                      Always On
                    </span>
                  </div>

                  {/* Customize Times - Expandable */}
                  <div className="pt-2">
                    <button
                      onClick={() => setShowCustomTimes(!showCustomTimes)}
                      className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Clock className="h-4 w-4" />
                      {showCustomTimes ? "Hide custom times" : "Customize times"}
                    </button>

                    {showCustomTimes && (
                      <div className="mt-4 space-y-4 p-4 rounded-lg bg-[var(--bg-elevated)]">
                        {/* Timezone */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Your Timezone</label>
                          <select
                            value={settings.timezone}
                            onChange={async (e) => {
                              const newTimezone = e.target.value;
                              setSettings({ ...settings, timezone: newTimezone });
                              await saveSettings({ timezone: newTimezone }, true);
                            }}
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                          >
                            {TIMEZONES.map((tz) => (
                              <option key={tz.value} value={tz.value}>
                                {tz.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Custom times */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                              🌅 Morning
                            </label>
                            <input
                              type="time"
                              value={settings.zeno_morning_time}
                              onChange={async (e) => {
                                const newTime = e.target.value;
                                setSettings({ ...settings, zeno_morning_time: newTime });
                                await saveSettings({ zeno_morning_time: newTime }, true);
                              }}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                              🌙 Evening
                            </label>
                            <input
                              type="time"
                              value={settings.zeno_eod_time}
                              onChange={async (e) => {
                                const newTime = e.target.value;
                                setSettings({ ...settings, zeno_eod_time: newTime });
                                await saveSettings({ zeno_eod_time: newTime }, true);
                              }}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Urgent Alerts */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Urgent Alerts</h2>
                  <p className="text-sm text-[var(--text-muted)]">Get notified immediately for time-sensitive emails</p>
                </div>
              </div>

              {/* AI Detection Note */}
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-blue-300 font-medium">AI-Powered Urgency Detection</p>
                    <p className="text-blue-300/80 mt-1">
                      Zeno automatically detects urgent matters like deadlines, meeting confirmations, 
                      personal requests (school pickups, RSVPs), and time-sensitive business emails. 
                      It's about <strong>90% accurate</strong> — occasionally something might slip through 
                      or get flagged incorrectly, but it catches most important things.
                    </p>
                  </div>
                </div>
              </div>

              {/* VIP Senders */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 text-amber-400" />
                  <h3 className="font-medium text-[var(--text-primary)]">VIP Senders</h3>
                  <span className="text-xs text-[var(--text-muted)]">— always alert, no AI needed</span>
                </div>
                
                <div className="space-y-3">
                  {/* Add VIP input */}
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newVip}
                      onChange={(e) => setNewVip(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addVipSender()}
                      placeholder="boss@company.com, partner@example.com"
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    <button
                      onClick={addVipSender}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>

                  {/* VIP list */}
                  {settings.vip_senders.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {settings.vip_senders.map((email) => (
                        <span
                          key={email}
                          className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm text-amber-300"
                        >
                          <Star className="h-3 w-3 text-amber-400" />
                          {email}
                          <button
                            onClick={() => removeVipSender(email)}
                            className="ml-1 rounded-full p-0.5 hover:bg-amber-500/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)] italic">
                      Add your boss, key clients, investors, or family members.
                    </p>
                  )}
                </div>
              </div>

              {/* What triggers urgent alerts */}
              <div className="rounded-lg bg-[var(--bg-elevated)] p-4">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">What triggers urgent alerts:</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">⭐</span> VIP sender emails
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">⏰</span> Deadline mentions
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">📅</span> Meeting confirmations
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">👨‍👩‍👧</span> Personal/family requests
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">💼</span> Client escalations
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-pink-400">💒</span> Event RSVPs
                  </div>
                </div>
              </div>
            </section>

            {/* Reply Behavior */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                  <Mail className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Reply Behavior</h2>
                  <p className="text-sm text-[var(--text-muted)]">How Zeno handles your email instructions</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Safe Mode Info */}
                <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <span className="text-xl flex-shrink-0">🔒</span>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Safe Mode</p>
                    <p className="text-sm text-[var(--text-muted)]">Zeno creates drafts instead of sending directly — you review <strong>BEFORE</strong> sending anything</p>
                  </div>
                </div>

                {/* Confirmation emails */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-elevated)]">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Action Confirmations</p>
                    <p className="text-sm text-[var(--text-muted)]">Get an email when Zeno completes your requests</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.zeno_confirmations !== false}
                      onChange={(e) => setSettings({ ...settings, zeno_confirmations: e.target.checked } as any)}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-[var(--bg-card)] peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/20 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full border border-[var(--border)]"></div>
                  </label>
                </div>
              </div>
            </section>

            {/* How to Reply */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
                  <MessageSquare className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">How to Reply</h2>
                  <p className="text-sm text-[var(--text-muted)]">Example of what Zeno's digest looks like</p>
                </div>
              </div>

              {/* Example Digest Preview */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 mb-4">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">Example Digest</p>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded bg-blue-500 text-white text-xs font-bold flex items-center justify-center">1</span>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">John Smith — Project proposal</p>
                      <p className="text-[var(--text-muted)]">"Hi, I wanted to follow up on the proposal..."</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded bg-blue-500 text-white text-xs font-bold flex items-center justify-center">2</span>
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Sarah Lee — Contract review</p>
                      <p className="text-[var(--text-muted)]">"Please review the attached contract..."</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Reply Format */}
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 mb-4">
                <p className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-2">Quick Reply</p>
                <p className="text-sm text-[var(--text-secondary)] mb-3">Reply with a number to take action:</p>
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <p><span className="font-mono font-bold text-blue-400">1</span> — Approve the proposal (notify John + schedule kickoff)</p>
                  <p><span className="font-mono font-bold text-blue-400">2</span> — Request changes to the contract</p>
                  <p><span className="font-mono font-bold text-blue-400">3</span> — Ask for more details</p>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-3 pt-3 border-t border-blue-500/20">
                  Or reply with your own instructions — Zeno will figure it out!
                </p>
              </div>

              {/* Other Commands */}
              <div className="space-y-2 text-sm">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">You can also say things like:</p>
                <div className="grid gap-2">
                  <code className="block bg-[var(--bg-elevated)] px-3 py-2 rounded text-[var(--text-secondary)]">Draft a reply to Sarah asking for revised pricing</code>
                  <code className="block bg-[var(--bg-elevated)] px-3 py-2 rounded text-[var(--text-secondary)]">Book a meeting with John tomorrow at 2pm</code>
                  <code className="block bg-[var(--bg-elevated)] px-3 py-2 rounded text-[var(--text-secondary)]">Tell Mike I'll be 15 minutes late</code>
                </div>
              </div>
            </section>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => saveSettings()}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-base font-medium text-white transition-all hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Settings className="h-5 w-5" />}
                Save Settings
              </button>

              <button
                onClick={sendTestDigest}
                disabled={testing}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-6 py-3 text-base font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                {testing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                Send Test Digest
              </button>
            </div>

            {/* How it works */}
            <section className="rounded-xl border-2 border-dashed border-[var(--border)] bg-gradient-to-br from-blue-500/5 to-purple-500/5 p-6">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-400" />
                How Zeno Works
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="text-center">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-blue-500/20 text-2xl mb-2">
                    📬
                  </div>
                  <p className="font-medium text-[var(--text-primary)]">1. Zeno emails you</p>
                  <p className="text-sm text-[var(--text-muted)]">Digests with what needs your attention</p>
                </div>
                <div className="text-center">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-purple-500/20 text-2xl mb-2">
                    ✍️
                  </div>
                  <p className="font-medium text-[var(--text-primary)]">2. You reply</p>
                  <p className="text-sm text-[var(--text-muted)]">Natural language instructions</p>
                </div>
                <div className="text-center">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-500/20 text-2xl mb-2">
                    ✅
                  </div>
                  <p className="font-medium text-[var(--text-primary)]">3. Zeno acts</p>
                  <p className="text-sm text-[var(--text-muted)]">Creates drafts, schedules, confirms</p>
                </div>
              </div>
              <p className="text-center text-sm text-[var(--text-muted)] mt-4">
                Stay off your inbox. Let Zeno handle the noise. You just reply. ✨
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
