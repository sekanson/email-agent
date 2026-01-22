"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Save, Tag, Loader2, Check, AlertCircle, Plus, Trash2, Eye, Code } from "lucide-react";

interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
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
  "1": { name: "To Respond", color: "#ef4444", enabled: true },
  "2": { name: "FYI", color: "#f59e0b", enabled: true },
  "3": { name: "Comment", color: "#10b981", enabled: true },
  "4": { name: "Notification", color: "#6366f1", enabled: true },
  "5": { name: "Meeting Update", color: "#8b5cf6", enabled: true },
  "6": { name: "Awaiting Reply", color: "#06b6d4", enabled: true },
  "7": { name: "Actioned", color: "#84cc16", enabled: true },
  "8": { name: "Marketing", color: "#f97316", enabled: true },
};

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

  // For demo purposes, we'll use a hardcoded email
  // In production, this would come from session/auth
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
        setSettings({
          temperature: data.settings.temperature ?? 0.7,
          signature: data.settings.signature ?? "",
          drafts_enabled: data.settings.drafts_enabled ?? true,
          auto_poll_enabled: data.settings.auto_poll_enabled ?? false,
          auto_poll_interval: data.settings.auto_poll_interval ?? 120,
          categories: data.settings.categories ?? DEFAULT_CATEGORIES,
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
      // First save current settings (including label prefix and categories)
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, settings }),
      });

      // Then sync labels (creates new, updates existing, deletes removed)
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
    const existingNums = Object.keys(settings.categories).map((n) => parseInt(n));
    const nextNum = Math.max(...existingNums) + 1;

    const colors = ["#ef4444", "#f59e0b", "#10b981", "#6366f1", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#14b8a6"];
    const color = colors[nextNum % colors.length];

    setSettings((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [nextNum.toString()]: {
          name: `Category ${nextNum}`,
          color,
          enabled: true,
        },
      },
    }));
  }

  function deleteCategory(num: string) {
    if (Object.keys(settings.categories).length <= 2) return;

    setSettings((prev) => {
      const newCategories = { ...prev.categories };
      delete newCategories[num];

      // Renumber categories to be sequential starting from 1
      const sorted = Object.entries(newCategories)
        .sort(([a], [b]) => parseInt(a) - parseInt(b));

      const renumbered: Record<string, CategoryConfig> = {};
      sorted.forEach(([, config], index) => {
        renumbered[(index + 1).toString()] = config;
      });

      return {
        ...prev,
        categories: renumbered,
      };
    });
  }

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
              <button
                onClick={addCategory}
                disabled={Object.keys(settings.categories).length >= 10}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Customize your email categories. The first category is always used for emails requiring a response (drafts will be created).
              Minimum 2 categories required. Deleting a category removes its Gmail label when you click &quot;Sync Labels&quot;.
            </p>

            <div className="space-y-3">
              {Object.entries(settings.categories)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([num, config], index) => (
                <div
                  key={num}
                  className="flex items-center gap-4 rounded-lg border border-gray-200 p-3 dark:border-gray-600"
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
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  {index === 0 && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      Drafts
                    </span>
                  )}
                  <button
                    onClick={() => deleteCategory(num)}
                    disabled={Object.keys(settings.categories).length <= 2}
                    className="rounded p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-red-900"
                    title={Object.keys(settings.categories).length <= 2 ? "Minimum 2 categories required" : "Delete category (sync to remove from Gmail)"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
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
