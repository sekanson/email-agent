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

  async function saveSettings() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, settings }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved!" });
      } else {
        setMessage({ type: "error", text: "Failed to save settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
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

  function toggleDigestType(type: string) {
    setSettings((prev) => ({
      ...prev,
      zeno_digest_types: prev.zeno_digest_types.includes(type)
        ? prev.zeno_digest_types.filter((t) => t !== type)
        : [...prev.zeno_digest_types, type],
    }));
  }

  function addVipSender() {
    if (!newVip.trim()) return;
    const email = newVip.trim().toLowerCase();
    if (!settings.vip_senders.includes(email)) {
      setSettings((prev) => ({
        ...prev,
        vip_senders: [...prev.vip_senders, email],
      }));
    }
    setNewVip("");
  }

  function removeVipSender(email: string) {
    setSettings((prev) => ({
      ...prev,
      vip_senders: prev.vip_senders.filter((e) => e !== email),
    }));
  }

  function enableFocusMode(duration: string) {
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
  }

  function disableFocusMode() {
    setSettings((prev) => ({
      ...prev,
      focus_mode_enabled: false,
      focus_mode_until: null,
    }));
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
        <main className="flex min-h-screen items-center justify-center pb-20 pt-14 lg:ml-60 lg:pb-0 lg:pt-0">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex min-h-screen items-center justify-center px-4 pb-20 pt-14 lg:ml-60 lg:pb-0 lg:pt-0">
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

      <main className="min-h-screen overflow-auto pb-20 pt-14 lg:ml-60 lg:pb-0 lg:pt-0">
        {/* Header */}
        <div className="sticky top-14 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 px-4 py-4 backdrop-blur-xl sm:px-8 sm:py-6 lg:top-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">Zeno Assistant</h1>
              <p className="text-sm text-[var(--text-muted)]">Your AI email companion</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8">
          {message && (
            <div
              className={`mb-6 flex items-center gap-2 rounded-xl p-4 text-sm ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {message.type === "success" ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              {message.text}
            </div>
          )}

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
                    onChange={(e) => setSettings({ ...settings, zeno_digest_enabled: e.target.checked })}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-[var(--bg-elevated)] peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500/20 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              {settings.zeno_digest_enabled && (
                <div className="space-y-3">
                  {/* Morning Brief */}
                  <div
                    onClick={() => toggleDigestType("morning")}
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
                      <span className="text-sm text-[var(--text-muted)]">9:00 AM</span>
                      {settings.zeno_digest_types.includes("morning") && (
                        <Check className="h-5 w-5 text-blue-400" />
                      )}
                    </div>
                  </div>

                  {/* EOD Wrap-up */}
                  <div
                    onClick={() => toggleDigestType("eod")}
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
                      <span className="text-sm text-[var(--text-muted)]">6:00 PM</span>
                      {settings.zeno_digest_types.includes("eod") && (
                        <Check className="h-5 w-5 text-blue-400" />
                      )}
                    </div>
                  </div>

                  {/* Weekly Digest */}
                  <div
                    onClick={() => toggleDigestType("weekly")}
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
                </div>
              )}
            </section>

            {/* VIP Senders */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                  <Star className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">VIP Senders</h2>
                  <p className="text-sm text-[var(--text-muted)]">Always get alerts for these people</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Add VIP input */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newVip}
                    onChange={(e) => setNewVip(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addVipSender()}
                    placeholder="email@example.com"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <button
                    onClick={addVipSender}
                    className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
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
                    No VIP senders yet. Add your boss, key clients, or family.
                  </p>
                )}
              </div>
            </section>

            {/* Timezone */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-elevated)]">
                  <Clock className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Timezone</h2>
                  <p className="text-sm text-[var(--text-muted)]">For scheduling digests</p>
                </div>
              </div>

              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </section>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={saveSettings}
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
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
              <h3 className="font-semibold text-[var(--text-primary)] mb-3">💡 How to use Zeno</h3>
              <div className="space-y-2 text-sm text-[var(--text-muted)]">
                <p>1. Zeno sends you email digests with what needs attention</p>
                <p>2. <strong className="text-[var(--text-secondary)]">Reply to the email</strong> with instructions like:</p>
                <div className="ml-4 space-y-1 font-mono text-xs bg-[var(--bg-card)] p-3 rounded-lg">
                  <p>"Reply 1 with: Sounds good, let's proceed"</p>
                  <p>"Tell Aamir I'll be there at 3pm"</p>
                  <p>"Draft a response for Sarah saying I need more time"</p>
                  <p>"Book a meeting with Hammad tomorrow at 9am"</p>
                </div>
                <p>3. Zeno executes your commands and confirms via email ✨</p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
