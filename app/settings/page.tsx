"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Save, Tag, Loader2, Check, AlertCircle, Plus, Trash2, Eye, Code, Lock, RotateCcw } from "lucide-react";

interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
  required?: boolean;
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

const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": { name: "To Respond", color: "#ef4444", enabled: true, required: true },
  "2": { name: "FYI", color: "#f59e0b", enabled: true },
  "3": { name: "Comment", color: "#10b981", enabled: true },
  "4": { name: "Notification", color: "#6366f1", enabled: true },
  "5": { name: "Meeting Update", color: "#8b5cf6", enabled: true },
  "6": { name: "Awaiting Reply", color: "#06b6d4", enabled: true },
  "7": { name: "Actioned", color: "#84cc16", enabled: true },
  "8": { name: "Marketing", color: "#f97316", enabled: true },
};

const OTHER_CATEGORY: CategoryConfig = {
  name: "Other",
  color: "#6b7280",
  enabled: true,
  required: true,
};

// Check if categories match the defaults (no Other needed)
function hasAllDefaults(categories: Record<string, CategoryConfig>): boolean {
  const defaultNames = Object.values(DEFAULT_CATEGORIES).map(c => c.name);
  const currentNames = Object.values(categories).map(c => c.name).filter(n => n !== "Other");
  return defaultNames.every(name => currentNames.includes(name)) && currentNames.length === 8;
}

// Process categories to ensure proper structure (add Other if needed, ensure order)
function processCategories(categories: Record<string, CategoryConfig>): Record<string, CategoryConfig> {
  const entries = Object.entries(categories);

  // Separate Other from rest
  const otherEntry = entries.find(([, c]) => c.name === "Other");
  const nonOther = entries.filter(([, c]) => c.name !== "Other");

  // Count non-Other categories
  const needsOther = nonOther.length < 8;

  // Build new categories object
  const result: Record<string, CategoryConfig> = {};

  // Add non-Other categories first, renumbered
  nonOther.forEach(([, config], index) => {
    result[(index + 1).toString()] = {
      ...config,
      // Ensure To Respond is always required
      required: config.name === "To Respond" ? true : config.required,
    };
  });

  // Add Other if needed
  if (needsOther) {
    const nextNum = nonOther.length + 1;
    result[nextNum.toString()] = otherEntry
      ? { ...otherEntry[1], required: true }
      : { ...OTHER_CATEGORY };
  }

  return result;
}

export default function Settings() {
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
  const [signaturePreview, setSignaturePreview] = useState(false);

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
        // Process categories to ensure proper structure
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
      // First save current settings
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, settings }),
      });

      // Then sync labels
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

    // Insert new category before Other (if exists) or at end
    const insertPosition = otherIndex !== -1 ? otherIndex : entries.length;
    const newNum = insertPosition + 1;
    const color = colors[newNum % colors.length];

    setSettings((prev) => {
      const newCategories = { ...prev.categories };

      // If Other exists, shift it
      if (otherIndex !== -1) {
        const otherKey = entries[otherIndex][0];
        const otherConfig = newCategories[otherKey];
        delete newCategories[otherKey];

        // Add new category
        newCategories[newNum.toString()] = {
          name: `New Category`,
          color,
          enabled: true,
        };

        // Re-add Other at new position
        newCategories[(newNum + 1).toString()] = otherConfig;
      } else {
        // No Other, just add at end
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

    // Can't delete required categories (To Respond, Other)
    if (category?.required) return;

    // Can't go below 2 (To Respond + Other)
    const nonOtherCount = Object.values(settings.categories).filter(c => c.name !== "Other").length;
    if (nonOtherCount <= 2) return;

    setSettings((prev) => {
      const newCategories = { ...prev.categories };
      delete newCategories[num];

      // Process will renumber and add Other if needed
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

  // Check if we're at defaults (for showing/hiding restore button)
  const isAtDefaults = hasAllDefaults(settings.categories);
  const nonOtherCount = Object.values(settings.categories).filter(c => c.name !== "Other").length;
  const canAddCategory = nonOtherCount < 8;

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </main>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              Not signed in
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Please sign in to access settings.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <main className="flex-1 overflow-auto p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure your email agent preferences
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 flex items-center gap-2 rounded-lg p-4 ${
              message.type === "success"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
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
          <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Tag className="h-5 w-5" />
                  Gmail Labels
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {user?.labels_created
                    ? "Sync labels with Gmail (creates new, updates colors, removes deleted)"
                    : "Create classification labels in your Gmail account"
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                {user?.labels_created && (
                  <span className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                    <Check className="h-4 w-4" />
                    Active
                  </span>
                )}
                <button
                  onClick={handleSyncLabels}
                  disabled={setupLoading}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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

          {/* Auto-Polling Settings */}
          <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Auto-Polling
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable Auto-Polling
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically check for new emails at regular intervals
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      auto_poll_enabled: !prev.auto_poll_enabled,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.auto_poll_enabled ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.auto_poll_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Polling Interval
                </label>
                <select
                  value={settings.auto_poll_interval}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      auto_poll_interval: parseInt(e.target.value),
                    }))
                  }
                  className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value={60}>Every 1 minute</option>
                  <option value={120}>Every 2 minutes</option>
                  <option value={180}>Every 3 minutes</option>
                  <option value={300}>Every 5 minutes</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  How often to check for new emails when auto-polling is enabled
                </p>
              </div>
            </div>
          </section>

          {/* Response Settings */}
          <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Response Settings
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Auto-generate Drafts
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Create draft responses for &quot;To Respond&quot; emails
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      drafts_enabled: !prev.drafts_enabled,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.drafts_enabled ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.drafts_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Response Temperature: {settings.temperature.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      temperature: parseFloat(e.target.value),
                    }))
                  }
                  className="mt-2 w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Conservative (0.0)</span>
                  <span>Creative (1.0)</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Signature
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      HTML Supported
                    </span>
                    {settings.signature && (
                      <button
                        type="button"
                        onClick={() => setSignaturePreview(!signaturePreview)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                      >
                        {signaturePreview ? (
                          <>
                            <Code className="h-3 w-3" />
                            Code
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" />
                            Preview
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Paste your email signature HTML code here. It will be appended to all generated drafts.
                </p>
                {signaturePreview && settings.signature ? (
                  <div className="mt-2 rounded-md border border-gray-300 bg-white p-4 dark:border-gray-600 dark:bg-gray-700">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: settings.signature }}
                    />
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={settings.signature}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        signature: e.target.value,
                      }))
                    }
                    className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="<div>
  <p>Best regards,</p>
  <p><strong>Your Name</strong></p>
  <p>Your Company | your@email.com</p>
</div>"
                  />
                )}
              </div>
            </div>
          </section>

          {/* Category Settings */}
          <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Categories
              </h2>
              <div className="flex items-center gap-2">
                {!isAtDefaults && (
                  <button
                    onClick={restoreDefaults}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore Defaults
                  </button>
                )}
                {canAddCategory && (
                  <button
                    onClick={addCategory}
                    className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Category
                  </button>
                )}
              </div>
            </div>

            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              {isAtDefaults
                ? "You have all 8 default categories. Delete any to add the \"Other\" catch-all category."
                : "\"Other\" catches emails that don\'t fit your remaining categories. Restore defaults to remove it."
              }
            </p>

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
                      className={`flex items-center gap-4 rounded-lg border p-3 ${
                        isRequired
                          ? "border-gray-300 bg-gray-50 dark:border-gray-500 dark:bg-gray-750"
                          : "border-gray-200 dark:border-gray-600"
                      }`}
                    >
                      <span className="w-6 text-center font-mono text-sm text-gray-500">
                        {num}
                      </span>
                      <input
                        type="color"
                        value={config.color}
                        onChange={(e) =>
                          updateCategory(num, "color", e.target.value)
                        }
                        className="h-8 w-8 cursor-pointer rounded border-0"
                      />
                      <input
                        type="text"
                        value={config.name}
                        onChange={(e) =>
                          updateCategory(num, "name", e.target.value)
                        }
                        disabled={isRequired}
                        className={`flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${
                          isRequired ? "bg-gray-100 dark:bg-gray-600" : ""
                        }`}
                      />
                      {isToRespond && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          Drafts
                        </span>
                      )}
                      {isOther && (
                        <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                          Catch-all
                        </span>
                      )}
                      {isRequired ? (
                        <div
                          className="rounded p-1.5 text-gray-400"
                          title={isToRespond ? "Required: emails needing response" : "Required: catches emails from deleted categories"}
                        >
                          <Lock className="h-4 w-4" />
                        </div>
                      ) : (
                        <button
                          onClick={() => deleteCategory(num)}
                          className="rounded p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900"
                          title="Delete category (sync to remove from Gmail)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Save Settings
          </button>
        </div>
      </main>
    </div>
  );
}
