"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Save, Tag, Loader2, Check, AlertCircle, Plus, Trash2, Lock, RotateCcw, AlertTriangle } from "lucide-react";
import { DEFAULT_CATEGORIES as SHARED_DEFAULTS, COLOR_PRESETS, type CategoryConfig } from "@/lib/categories";

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

// Helper functions for prefix management
function getPrefixedName(name: string, order: number): string {
  const displayName = getDisplayName(name);
  return `${order}: ${displayName}`;
}

function getDisplayName(prefixedName: string): string {
  return prefixedName.replace(/^\d+:\s*/, "");
}

function isOtherCategory(name: string): boolean {
  return getDisplayName(name) === "Other";
}

function isRespondCategory(name: string): boolean {
  const displayName = getDisplayName(name);
  return displayName === "To Respond" || displayName === "Respond";
}

// Build DEFAULT_CATEGORIES from shared defaults (adds number prefixes)
const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = Object.fromEntries(
  Object.entries(SHARED_DEFAULTS).map(([key, config]) => [
    key,
    { ...config, name: `${key}: ${config.name}` }
  ])
);

const OTHER_CATEGORY: CategoryConfig = {
  name: "Other",
  color: "#9CA3AF",
  enabled: true,
  required: true,
  description: "Catch-all for uncategorized emails",
  rules: "",
  drafts: false,
  order: 99,
};

// Get display names from shared defaults
const DEFAULT_DISPLAY_NAMES = Object.values(SHARED_DEFAULTS).map(c => c.name);

function hasAllDefaults(categories: Record<string, CategoryConfig>): boolean {
  const currentDisplayNames = Object.values(categories)
    .map(c => getDisplayName(c.name))
    .filter(n => n !== "Other");
  return DEFAULT_DISPLAY_NAMES.every(name => currentDisplayNames.includes(name)) && currentDisplayNames.length === 8;
}

function processCategories(categories: Record<string, CategoryConfig>): Record<string, CategoryConfig> {
  const entries = Object.entries(categories);
  const otherEntry = entries.find(([, c]) => isOtherCategory(c.name));
  const nonOther = entries.filter(([, c]) => !isOtherCategory(c.name));
  const needsOther = nonOther.length < 8;
  const result: Record<string, CategoryConfig> = {};

  // Sort: Respond always first, then by current order
  const sorted = nonOther.sort((a, b) => {
    if (isRespondCategory(a[1].name)) return -1;
    if (isRespondCategory(b[1].name)) return 1;
    return (a[1].order || 0) - (b[1].order || 0);
  });

  sorted.forEach(([, config], index) => {
    const order = index + 1;
    const displayName = getDisplayName(config.name);
    result[order.toString()] = {
      ...config,
      name: getPrefixedName(displayName, order),
      required: isRespondCategory(config.name) ? true : config.required,
      order,
    };
  });

  if (needsOther) {
    const nextNum = sorted.length + 1;
    const otherConfig = otherEntry ? otherEntry[1] : OTHER_CATEGORY;
    result[nextNum.toString()] = {
      ...otherConfig,
      name: getPrefixedName("Other", nextNum),
      required: true,
      order: nextNum,
    };
  }

  return result;
}

function getPlaceholder(category: CategoryConfig, isDefault: boolean): string {
  const displayName = getDisplayName(category.name);
  if (displayName === "Other") {
    return "Describe what belongs here for the AI...";
  }
  if (isDefault && !category.rules) {
    return "Add extra rules for AI...";
  }
  if (!isDefault) {
    return "Describe what belongs here for the AI...";
  }
  return "Tell AI what to look for...";
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);
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
        setMessage({ type: "success", text: "Settings saved! Sync labels to update Gmail." });
        setHasUnsavedChanges(false);
        setNeedsSync(true);
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
        setHasUnsavedChanges(false);
        setNeedsSync(false);
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
    value: string | boolean | number
  ) {
    setHasUnsavedChanges(true);
    setSettings((prev) => {
      const category = prev.categories[num];
      if (!category) return prev;

      let newValue = value;

      // When updating name, preserve the prefix
      if (field === "name" && typeof value === "string") {
        const order = category.order;
        newValue = getPrefixedName(value, order);
      }

      return {
        ...prev,
        categories: {
          ...prev.categories,
          [num]: {
            ...category,
            [field]: newValue,
          },
        },
      };
    });
  }

  function addCategory() {
    const nonOtherCount = Object.values(settings.categories).filter(c => !isOtherCategory(c.name)).length;
    if (nonOtherCount >= 8) return;
    setHasUnsavedChanges(true);

    const entries = Object.entries(settings.categories);
    const otherIndex = entries.findIndex(([, c]) => isOtherCategory(c.name));
    const colors = ["#F87171", "#FB923C", "#22D3EE", "#4ADE80", "#A855F7", "#60A5FA", "#2DD4BF", "#F472B6", "#EC4899", "#14B8A6"];
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
          name: getPrefixedName("New Category", newNum),
          color,
          enabled: true,
          description: "Custom category",
          rules: "",
          drafts: false,
          order: newNum,
        };

        newCategories[(newNum + 1).toString()] = {
          ...otherConfig,
          name: getPrefixedName("Other", newNum + 1),
          order: newNum + 1
        };
      } else {
        newCategories[newNum.toString()] = {
          name: getPrefixedName("New Category", newNum),
          color,
          enabled: true,
          description: "Custom category",
          rules: "",
          drafts: false,
          order: newNum,
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

    const nonOtherCount = Object.values(settings.categories).filter(c => !isOtherCategory(c.name)).length;
    if (nonOtherCount <= 2) return;

    setHasUnsavedChanges(true);
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
      setHasUnsavedChanges(true);
      setSettings((prev) => ({
        ...prev,
        categories: { ...DEFAULT_CATEGORIES },
      }));
    }
  }

  const isAtDefaults = hasAllDefaults(settings.categories);
  const nonOtherCount = Object.values(settings.categories).filter(c => !isOtherCategory(c.name)).length;
  const canAddCategory = nonOtherCount < 8;

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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      <main className="min-h-screen overflow-auto pb-20 pt-14 lg:ml-60 lg:pb-0 lg:pt-0">
        {/* Header */}
        <div className="sticky top-14 z-10 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 px-4 py-4 backdrop-blur-xl sm:px-8 sm:py-6 lg:top-0">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">Categorize</h1>
          <p className="text-sm text-[var(--text-muted)] sm:text-base">Configure your email classification categories</p>
        </div>

        <div className="p-4 sm:p-8">
          {message && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-sm sm:mb-6 sm:p-4 sm:text-base ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {message.type === "success" ? (
                <Check className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              {message.text}
            </div>
          )}

          <div className="max-w-3xl space-y-4 sm:space-y-6">
            {/* Gmail Labels Setup */}
            <section className="glass-card p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)] sm:text-lg">
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
                  {user?.labels_created && !needsSync && !hasUnsavedChanges && (
                    <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                      <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-500" />
                      Synced
                    </span>
                  )}
                  {(needsSync || hasUnsavedChanges) && user?.labels_created && (
                    <span className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {hasUnsavedChanges ? "Unsaved" : "Out of Sync"}
                    </span>
                  )}
                  <button
                    onClick={handleSyncLabels}
                    disabled={setupLoading}
                    className={`flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all hover:shadow-md disabled:opacity-50 sm:min-h-0 sm:py-2 ${
                      needsSync || hasUnsavedChanges
                        ? "bg-amber-500 hover:bg-amber-600 hover:shadow-amber-500/10"
                        : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] hover:shadow-blue-500/10"
                    }`}
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
            <section className="glass-card p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Categories</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {isAtDefaults
                      ? "You have all 8 default categories. Delete any to add the \"Other\" catch-all."
                      : "\"Other\" catches emails that don't fit your remaining categories."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!isAtDefaults && (
                    <button
                      onClick={restoreDefaults}
                      className="flex min-h-[44px] items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] sm:min-h-0 sm:py-1.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span className="hidden sm:inline">Restore Defaults</span>
                      <span className="sm:hidden">Reset</span>
                    </button>
                  )}
                  {canAddCategory && (
                    <button
                      onClick={addCategory}
                      className="flex min-h-[44px] items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 sm:min-h-0 sm:py-1.5"
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
                    const displayName = getDisplayName(config.name);
                    const isRespond = isRespondCategory(config.name);
                    const isOther = isOtherCategory(config.name);
                    const isRequired = config.required || isRespond || isOther;
                    const isDefault = DEFAULT_DISPLAY_NAMES.includes(displayName);

                    return (
                      <div
                        key={num}
                        className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 transition-all hover:border-[var(--border-hover)] sm:p-4"
                      >
                        {/* Row 1: Color + Prefix + Name + Actions */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button
                            type="button"
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg sm:h-6 sm:w-6"
                            style={{ backgroundColor: config.color }}
                            onClick={() => {
                              const input = document.getElementById(`color-${num}`) as HTMLInputElement;
                              input?.click();
                            }}
                          />
                          <input
                            id={`color-${num}`}
                            type="color"
                            value={config.color}
                            onChange={(e) =>
                              updateCategory(num, "color", e.target.value)
                            }
                            className="sr-only"
                          />
                          <div className="flex flex-1 items-center gap-1">
                            <span className="text-sm font-semibold text-[var(--text-muted)] sm:text-base">{num}:</span>
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) =>
                                updateCategory(num, "name", e.target.value)
                              }
                              disabled={isRequired}
                              className={`min-h-[44px] min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] focus:outline-none sm:min-h-0 sm:text-base ${
                                isRequired ? "cursor-not-allowed" : ""
                              }`}
                              placeholder="Category name"
                            />
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            {config.drafts && (
                              <span className="hidden rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--accent)] sm:inline-block">
                                Drafts
                              </span>
                            )}
                            {isOther && (
                              <span className="hidden rounded-full bg-[var(--text-muted)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)] sm:inline-block">
                                Catch-all
                              </span>
                            )}
                            {isRequired ? (
                              <div
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--text-muted)] sm:min-h-0 sm:min-w-0 sm:p-2"
                                title={isRespond ? "Required: emails needing response" : "Required: catches uncategorized emails"}
                              >
                                <Lock className="h-4 w-4" />
                              </div>
                            ) : (
                              <button
                                onClick={() => deleteCategory(num)}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 sm:min-h-0 sm:min-w-0 sm:p-2"
                                title="Delete category (sync to remove from Gmail)"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Mobile badges row */}
                        <div className="mt-2 flex flex-wrap gap-2 sm:hidden">
                          {config.drafts && (
                            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                              Drafts
                            </span>
                          )}
                          {isOther && (
                            <span className="rounded-full bg-[var(--text-muted)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                              Catch-all
                            </span>
                          )}
                        </div>

                        {/* Row 2: Static description */}
                        <p className="mt-1 text-sm text-zinc-500 sm:ml-7">
                          {config.description || "Custom category"}
                        </p>

                        {/* Row 3: AI Rules input */}
                        <input
                          type="text"
                          value={config.rules || ""}
                          onChange={(e) =>
                            updateCategory(num, "rules", e.target.value)
                          }
                          placeholder={getPlaceholder(config, isDefault)}
                          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--border-hover)] focus:outline-none sm:ml-7 sm:w-[calc(100%-1.75rem)] sm:py-2"
                        />
                      </div>
                    );
                  })}
              </div>
            </section>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-4 text-base font-medium text-white transition-all hover:bg-[var(--accent-hover)] hover:shadow-md hover:shadow-blue-500/10 disabled:opacity-50 sm:min-h-0 sm:py-3"
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
