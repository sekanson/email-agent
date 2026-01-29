"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useUpgradePrompt } from "@/lib/use-upgrade-prompt";
import { type UserSettings } from "@/lib/settings-merge";
import { Save, Tag, Loader2, Check, AlertCircle, Plus, Trash2, Lock, RotateCcw, AlertTriangle, ChevronDown } from "lucide-react";
import { DEFAULT_CATEGORIES as SHARED_DEFAULTS, DEFAULT_CATEGORIES_V2, type CategoryConfig } from "@/lib/categories";

// Gmail's allowed label colors - these are the ONLY colors that work in Gmail
const GMAIL_COLORS = [
  { bg: "#fb4c2f", name: "Red" },
  { bg: "#cc3a21", name: "Dark Red" },
  { bg: "#ffad47", name: "Orange" },
  { bg: "#fad165", name: "Yellow" },
  { bg: "#16a766", name: "Green" },
  { bg: "#43d692", name: "Light Green" },
  { bg: "#4a86e8", name: "Blue" },
  { bg: "#a479e2", name: "Purple" },
  { bg: "#f691b3", name: "Pink" },
  { bg: "#2da2bb", name: "Cyan" },
  { bg: "#b99aff", name: "Light Purple" },
  { bg: "#ff7537", name: "Orange Red" },
];

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
  const displayName = getDisplayName(name).toLowerCase();
  return displayName === "to respond" || displayName === "respond" || displayName === "reply needed";
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
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [deletingLabels, setDeletingLabels] = useState(false);

  // Upgrade prompt hook - only for categories
  const {
    currentPrompt,
    handleUpgradeAction,
  } = useUpgradePrompt(userSettings);

  // Only show category upgrade prompts on this page
  const showCategoryUpgrade = currentPrompt?.schema === 'categories';

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

  // Close color pickers when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('[id^="color-picker-"]') && !target.closest('button[title="Click to change color"]')) {
        document.querySelectorAll('[id^="color-picker-"]').forEach((picker) => {
          picker.classList.add('hidden');
        });
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchSettings(bustCache = false) {
    try {
      const cacheParam = bustCache ? `&_t=${Date.now()}` : '';
      const res = await fetch(`/api/settings?userEmail=${userEmail}${cacheParam}`);
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
        // Store full settings for upgrade prompt
        setUserSettings(data.settings);
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

  async function deleteExistingLabels() {
    if (!confirm("⚠️ DELETE ALL GMAIL LABELS?\n\nThis will permanently delete ALL your custom Gmail labels (not just Zeno labels). System labels like Inbox, Sent, etc. will be kept.\n\nUse this if you want to start completely fresh with only Zeno categories.\n\nThis cannot be undone!")) {
      return;
    }
    
    setDeletingLabels(true);
    try {
      const res = await fetch('/api/delete-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessage({ 
          type: "success", 
          text: `${data.message}. Your Gmail is now label-free! Click 'Save & Sync to Gmail' to set up Zeno categories.` 
        });
        setNeedsSync(true);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to delete labels" });
      }
    } catch (error) {
      console.error("Failed to delete labels:", error);
      setMessage({ type: "error", text: "Failed to delete labels. Please try again." });
    } finally {
      setDeletingLabels(false);
    }
  }

  const isAtDefaults = hasAllDefaults(settings.categories);
  const nonOtherCount = Object.values(settings.categories).filter(c => !isOtherCategory(c.name)).length;
  const canAddCategory = nonOtherCount < 8;

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

  // Handle upgrade action and refresh settings
  const handleUpgradeWithRefresh = async (action: 'upgrade' | 'keep' | 'dismiss') => {
    try {
      const success = await handleUpgradeAction(userEmail, action);
      if (success && action === 'upgrade') {
        // Refresh settings with cache bust to show updated categories
        await fetchSettings(true);
        setMessage({ type: "success", text: "Categories upgraded! Your new categories are ready. Click 'Save & Sync to Gmail' to apply." });
        setNeedsSync(true);
      } else if (success) {
        // For keep/dismiss, just refresh to ensure sync
        await fetchSettings(true);
      }
    } catch (error) {
      console.error("Upgrade action failed:", error);
      setMessage({ type: "error", text: "Upgrade failed. Please try again." });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      {/* Category Upgrade Prompt */}
      {showCategoryUpgrade && currentPrompt && (
        <UpgradePrompt
          schema={currentPrompt.schema}
          fromVersion={currentPrompt.fromVersion}
          toVersion={currentPrompt.toVersion}
          userEmail={userEmail}
          onUpgrade={() => handleUpgradeWithRefresh('upgrade')}
          onDismiss={() => handleUpgradeWithRefresh('dismiss')}
          onKeepCurrent={() => handleUpgradeWithRefresh('keep')}
        />
      )}

      <main className="min-h-screen overflow-auto pb-20 pt-12 lg:ml-60 lg:pb-0 lg:pt-0">
        {/* Header */}
        <div className="border-b border-[var(--border)] bg-[var(--bg-primary)] px-4 py-4 sm:px-8 sm:py-6">
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
            {/* Gmail Sync Status */}
            <section className="glass-card p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tag className="h-5 w-5 text-[var(--accent)]" />
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Gmail Labels</span>
                    <span className="mx-2 text-[var(--text-muted)]">·</span>
                    <span className="text-sm text-[var(--text-muted)]">
                      {user?.labels_created ? "Connected" : "Not set up"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user?.labels_created && !needsSync && !hasUnsavedChanges && (
                    <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                      <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-500" />
                      Synced
                    </span>
                  )}
                  {(needsSync || hasUnsavedChanges) && (
                    <span className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {hasUnsavedChanges ? "Unsaved changes" : "Needs sync"}
                    </span>
                  )}
                  {!user?.labels_created && (
                    <span className="flex items-center gap-2 rounded-full bg-zinc-500/10 px-3 py-1 text-xs font-medium text-zinc-400">
                      Setup required
                    </span>
                  )}
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
                          <div className="relative">
                            <button
                              type="button"
                              className="group flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all hover:ring-2 hover:ring-[var(--border)] sm:h-6 sm:w-6"
                              style={{ backgroundColor: config.color }}
                              onClick={() => {
                                const picker = document.getElementById(`color-picker-${num}`);
                                picker?.classList.toggle("hidden");
                              }}
                              title="Click to change color"
                            >
                              <ChevronDown className="h-3 w-3 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <div
                              id={`color-picker-${num}`}
                              className="hidden absolute top-full left-0 mt-1 z-50 p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg"
                            >
                              <div className="grid grid-cols-4 gap-1.5">
                                {GMAIL_COLORS.map((gmailColor) => (
                                  <button
                                    key={gmailColor.bg}
                                    type="button"
                                    title={gmailColor.name}
                                    className={`h-6 w-6 rounded-md transition-all hover:scale-110 ${
                                      config.color.toLowerCase() === gmailColor.bg.toLowerCase()
                                        ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-card)]"
                                        : ""
                                    }`}
                                    style={{ backgroundColor: gmailColor.bg }}
                                    onClick={() => {
                                      updateCategory(num, "color", gmailColor.bg);
                                      document.getElementById(`color-picker-${num}`)?.classList.add("hidden");
                                    }}
                                  />
                                ))}
                              </div>
                              <p className="mt-2 text-[10px] text-[var(--text-muted)] text-center">Gmail colors</p>
                            </div>
                          </div>
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

            {/* Save & Sync Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {/* Primary action: Sync to Gmail */}
              <button
                onClick={handleSyncLabels}
                disabled={setupLoading || (user?.labels_created && !needsSync && !hasUnsavedChanges)}
                className={`flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-4 text-base font-medium text-white transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-3 ${
                  hasUnsavedChanges || needsSync
                    ? "bg-amber-500 hover:bg-amber-600 hover:shadow-amber-500/10"
                    : "bg-emerald-500 hover:bg-emerald-600 hover:shadow-emerald-500/10"
                }`}
              >
                {setupLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Tag className="h-5 w-5" />
                )}
                {hasUnsavedChanges ? "Save & Sync to Gmail" : user?.labels_created ? (needsSync ? "Sync Labels" : "Labels Synced") : "Setup Gmail Labels"}
              </button>
              
              {/* Secondary: Save only (without sync) */}
              {hasUnsavedChanges && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50 sm:min-h-0"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save only
                </button>
              )}
            </div>
            
            <p className="text-center text-xs text-[var(--text-muted)]">
              Changes are saved to your settings and then synced to Gmail labels.
            </p>

            {/* Start Fresh - Delete All Labels */}
            <section className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-red-400">Start Fresh</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Too many Gmail labels? Delete all custom labels and start fresh with only Zeno categories. System labels (Inbox, Sent, etc.) are preserved.
                  </p>
                </div>
                <button
                  onClick={deleteExistingLabels}
                  disabled={deletingLabels}
                  className="flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50 sm:min-h-0"
                >
                  {deletingLabels ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete All Labels
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
