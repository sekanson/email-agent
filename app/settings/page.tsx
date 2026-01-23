"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Save, Tag, Loader2, Check, AlertCircle, Plus, Trash2, Lock, RotateCcw } from "lucide-react";

interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
  required?: boolean;
  rules?: string;
}

interface Settings {
  temperature: number;
  signature: string;
  drafts_enabled: boolean;
  auto_poll_enabled: boolean;
  auto_poll_interval: number;
  categories: Record<string, CategoryConfig>;
}

interface User {
  email: string;
  name: string;
  picture: string;
  labels_created: boolean;
}

const DEFAULT_RULES: Record<string, string> = {
  "To Respond": "Direct questions or personal requests that genuinely need my reply. Exclude newsletters, marketing, cold outreach, and automated emails even if they contain questions or personalization.",
  "FYI": "Informational emails I should be aware of but don't require a response or action.",
  "Comment": "Notifications about comments on documents, tasks, code reviews, or threads I'm involved in.",
  "Notification": "Automated system notifications, alerts, status updates, and confirmations from apps and services.",
  "Meeting Update": "Calendar invites, meeting changes, scheduling requests, RSVPs, and video call links.",
  "Awaiting Reply": "Email threads where I've already responded and am waiting for the other person.",
  "Actioned": "Emails I've already handled, completed tasks, or resolved issues.",
  "Marketing": "Promotional content, newsletters, sales outreach, cold emails, and mass campaigns. Includes emails using personalization tricks to appear personal but are automated.",
  "Other": "Emails that don't clearly fit any other category.",
};

const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": { name: "To Respond", color: "#F87171", enabled: true, required: true, rules: DEFAULT_RULES["To Respond"] },
  "2": { name: "FYI", color: "#FB923C", enabled: true, rules: DEFAULT_RULES["FYI"] },
  "3": { name: "Comment", color: "#22D3EE", enabled: true, rules: DEFAULT_RULES["Comment"] },
  "4": { name: "Notification", color: "#4ADE80", enabled: true, rules: DEFAULT_RULES["Notification"] },
  "5": { name: "Meeting Update", color: "#A855F7", enabled: true, rules: DEFAULT_RULES["Meeting Update"] },
  "6": { name: "Awaiting Reply", color: "#60A5FA", enabled: true, rules: DEFAULT_RULES["Awaiting Reply"] },
  "7": { name: "Actioned", color: "#2DD4BF", enabled: true, rules: DEFAULT_RULES["Actioned"] },
  "8": { name: "Marketing", color: "#F472B6", enabled: true, rules: DEFAULT_RULES["Marketing"] },
};

const OTHER_CATEGORY: CategoryConfig = {
  name: "Other",
  color: "#6b7280",
  enabled: true,
  required: true,
  rules: DEFAULT_RULES["Other"],
};

function hasAllDefaults(categories: Record<string, CategoryConfig>): boolean {
  const defaultNames = Object.values(DEFAULT_CATEGORIES).map(c => c.name);
  const currentNames = Object.values(categories).map(c => c.name).filter(n => n !== "Other");
  return defaultNames.every(name => currentNames.includes(name)) && currentNames.length === 8;
}

function processCategories(categories: Record<string, CategoryConfig>): Record<string, CategoryConfig> {
  const entries = Object.entries(categories);
  const otherEntry = entries.find(([, c]) => c.name === "Other");
  const nonOther = entries.filter(([, c]) => c.name !== "Other");
  const needsOther = nonOther.length < 8;
  const result: Record<string, CategoryConfig> = {};

  nonOther.forEach(([, config], index) => {
    result[(index + 1).toString()] = {
      ...config,
      required: config.name === "To Respond" ? true : config.required,
    };
  });

  if (needsOther) {
    const nextNum = nonOther.length + 1;
    result[nextNum.toString()] = otherEntry
      ? { ...otherEntry[1], required: true }
      : { ...OTHER_CATEGORY };
  }

  return result;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings>({
    temperature: 0.7,
    signature: "",
    drafts_enabled: true,
    auto_poll_enabled: false,
    auto_poll_interval: 120,
    categories: DEFAULT_CATEGORIES,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const userEmail =
    typeof window !== "undefined"
      ? localStorage.getItem("userEmail") || ""
      : "";

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

      if (data.user) {
        setUser(data.user);
      }
      if (data.settings) {
        const categories = processCategories(data.settings.categories ?? DEFAULT_CATEGORIES);
        setSettings({
          temperature: data.settings.temperature ?? 0.7,
          signature: data.settings.signature ?? "",
          drafts_enabled: data.settings.drafts_enabled ?? true,
          auto_poll_enabled: data.settings.auto_poll_enabled ?? false,
          auto_poll_interval: data.settings.auto_poll_interval ?? 120,
          categories,
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, settings }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved successfully!" });
      } else {
        setMessage({ type: "error", text: "Failed to save settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncLabels() {
    setSetupLoading(true);
    setMessage(null);

    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, settings }),
      });

      const res = await fetch("/api/sync-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        const stats = data.stats || {};
        let statusText = "Labels synced! ";
        if (stats.created > 0) statusText += `${stats.created} created. `;
        if (stats.updated > 0) statusText += `${stats.updated} updated. `;
        if (stats.deleted > 0) statusText += `${stats.deleted} deleted from Gmail. `;

        setMessage({
          type: "success",
          text: statusText.trim(),
        });
        setUser((prev) => (prev ? { ...prev, labels_created: true } : null));
      } else {
        setMessage({ type: "error", text: data.error || "Failed to sync labels" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to sync labels" });
    } finally {
      setSetupLoading(false);
    }
  }

  function updateCategory(
    num: string,
    field: keyof CategoryConfig,
    value: string | boolean
  ) {
    setSettings((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [num]: {
          ...prev.categories[num],
          [field]: value,
        },
      },
    }));
  }

  function addCategory() {
    const nonOtherCount = Object.values(settings.categories).filter(c => c.name !== "Other").length;
    if (nonOtherCount >= 8) return;

    const entries = Object.entries(settings.categories);
    const otherIndex = entries.findIndex(([, c]) => c.name === "Other");
    const colors = ["#ef4444", "#f59e0b", "#10b981", "#6366f1", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#14b8a6"];
    const insertPosition = otherIndex !== -1 ? otherIndex : entries.length;
    const newNum = insertPosition + 1;
    const color = colors[newNum % colors.length];

    setSettings((prev) => {
      const newCategories = { ...prev.categories };

      if (otherIndex !== -1) {
        const otherKey = entries[otherIndex][0];
        const otherConfig = newCategories[otherKey];
        delete newCategories[otherKey];

        newCategories[newNum.toString()] = {
          name: `New Category`,
          color,
          enabled: true,
        };

        newCategories[(newNum + 1).toString()] = otherConfig;
      } else {
        newCategories[newNum.toString()] = {
          name: `New Category`,
          color,
          enabled: true,
        };
      }

      return {
        ...prev,
        categories: processCategories(newCategories),
      };
    });
  }

  function deleteCategory(num: string) {
    const category = settings.categories[num];
    if (category?.required) return;

    const nonOtherCount = Object.values(settings.categories).filter(c => c.name !== "Other").length;
    if (nonOtherCount <= 2) return;

    setSettings((prev) => {
      const newCategories = { ...prev.categories };
      delete newCategories[num];

      return {
        ...prev,
        categories: processCategories(newCategories),
      };
    });
  }

  function restoreDefaults() {
    if (confirm("Reset all categories to defaults? This will remove any custom categories.")) {
      setSettings((prev) => ({
        ...prev,
        categories: { ...DEFAULT_CATEGORIES },
      }));
    }
  }

  const isAtDefaults = hasAllDefaults(settings.categories);
  const nonOtherCount = Object.values(settings.categories).filter(c => c.name !== "Other").length;
  const canAddCategory = nonOtherCount < 8;

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="flex min-h-screen bg-[var(--bg-primary)]">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
              Not signed in
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">
              Please sign in to access settings.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 px-8 py-6 backdrop-blur-xl">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Settings</h1>
          <p className="text-[var(--text-muted)]">Configure your email agent preferences</p>
        </div>

        <div className="p-8">
          {message && (
            <div
              className={`mb-6 flex items-center gap-2 rounded-xl p-4 ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {message.type === "success" ? (
                <Check className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              {message.text}
            </div>
          )}

          <div className="max-w-3xl space-y-6">
            {/* Gmail Labels Setup */}
            <section className="glass-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
                    <Tag className="h-5 w-5 text-[var(--accent)]" />
                    Gmail Labels
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {user?.labels_created
                      ? "Sync labels with Gmail (creates new, updates colors, removes deleted)"
                      : "Create classification labels in your Gmail account"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {user?.labels_created && (
                    <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                      <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  )}
                  <button
                    onClick={handleSyncLabels}
                    disabled={setupLoading}
                    className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--accent-hover)] hover:shadow-lg hover:shadow-[var(--accent)]/20 disabled:opacity-50"
                  >
                    {setupLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Tag className="h-4 w-4" />
                    )}
                    {user?.labels_created ? "Sync Labels" : "Setup Labels"}
                  </button>
                </div>
              </div>
            </section>

            {/* Category Settings */}
            <section className="glass-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Categories</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {isAtDefaults
                      ? "You have all 8 default categories. Delete any to add the \"Other\" catch-all category."
                      : "\"Other\" catches emails that don't fit your remaining categories."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!isAtDefaults && (
                    <button
                      onClick={restoreDefaults}
                      className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore Defaults
                    </button>
                  )}
                  {canAddCategory && (
                    <button
                      onClick={addCategory}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(settings.categories)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([num, config]) => {
                    const isToRespond = config.name === "To Respond";
                    const isOther = config.name === "Other";
                    const isRequired = config.required || isToRespond || isOther;

                    return (
                      <div
                        key={num}
                        className={`rounded-xl border p-4 transition-all ${
                          isRequired
                            ? "border-[var(--border)] bg-[var(--bg-secondary)]"
                            : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="w-6 text-center font-mono text-sm text-[var(--text-muted)]">
                            {num}
                          </span>
                          <input
                            type="color"
                            value={config.color}
                            onChange={(e) =>
                              updateCategory(num, "color", e.target.value)
                            }
                            className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={config.name}
                            onChange={(e) =>
                              updateCategory(num, "name", e.target.value)
                            }
                            disabled={isRequired}
                            className={`flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 ${
                              isRequired
                                ? "bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                                : "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                            }`}
                          />
                          {isToRespond && (
                            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                              Drafts
                            </span>
                          )}
                          {isOther && (
                            <span className="rounded-full bg-[var(--text-muted)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                              Catch-all
                            </span>
                          )}
                          {isRequired ? (
                            <div
                              className="rounded-lg p-2 text-[var(--text-muted)]"
                              title={isToRespond ? "Required: emails needing response" : "Required: catches emails from deleted categories"}
                            >
                              <Lock className="h-4 w-4" />
                            </div>
                          ) : (
                            <button
                              onClick={() => deleteCategory(num)}
                              className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                              title="Delete category (sync to remove from Gmail)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="mt-3 pl-10">
                          <input
                            type="text"
                            value={config.rules || ""}
                            onChange={(e) =>
                              updateCategory(num, "rules", e.target.value)
                            }
                            placeholder="Tell AI what to look for..."
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent)] focus:bg-[var(--bg-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 font-medium text-white transition-all hover:bg-[var(--accent-hover)] hover:shadow-lg hover:shadow-[var(--accent)]/20 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Save Settings
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
