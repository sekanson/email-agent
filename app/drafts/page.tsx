"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import {
  Save,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  Code,
  Sparkles,
  PenTool,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

type ResponseStyle = "concise" | "balanced" | "detailed";

interface DraftSettings {
  drafts_enabled: boolean;
  response_style: ResponseStyle;
  signature: string;
  use_writing_style: boolean;
  writing_style?: string;
}

// Map response style to internal temperature value for storage
const STYLE_TO_TEMP: Record<ResponseStyle, number> = {
  concise: 0.3,
  balanced: 0.5,
  detailed: 0.7,
};

// Map temperature back to response style
function tempToStyle(temp: number): ResponseStyle {
  if (temp <= 0.4) return "concise";
  if (temp <= 0.6) return "balanced";
  return "detailed";
}

interface User {
  email: string;
  name: string;
  picture: string;
}

export default function DraftsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<DraftSettings>({
    drafts_enabled: true,
    response_style: "balanced",
    signature: "",
    use_writing_style: false,
    writing_style: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [signaturePreview, setSignaturePreview] = useState(false);
  const [resetting, setResetting] = useState(false);

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
          drafts_enabled: data.settings.drafts_enabled ?? true,
          response_style: tempToStyle(data.settings.temperature ?? 0.5),
          signature: data.settings.signature ?? "",
          use_writing_style: data.settings.use_writing_style ?? false,
          writing_style: data.settings.writing_style ?? "",
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
        body: JSON.stringify({
          userEmail,
          settings: {
            drafts_enabled: settings.drafts_enabled,
            temperature: STYLE_TO_TEMP[settings.response_style],
            response_style: settings.response_style,
            signature: settings.signature,
            use_writing_style: settings.use_writing_style,
            writing_style: settings.writing_style,
          },
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Draft settings saved!" });
      } else {
        setMessage({ type: "error", text: "Failed to save settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }

  async function analyzeWritingStyle() {
    setAnalyzing(true);
    setMessage(null);

    try {
      const res = await fetch("/api/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });

      const data = await res.json();

      if (res.ok && data.style) {
        setSettings((prev) => ({
          ...prev,
          writing_style: data.style,
          use_writing_style: true,
        }));
        setMessage({
          type: "success",
          text: `Analyzed ${data.emailsAnalyzed} sent emails to learn your writing style!`,
        });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to analyze writing style",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to analyze writing style" });
    } finally {
      setAnalyzing(false);
    }
  }

  async function resetToDefaults() {
    const confirmReset = confirm("Reset all draft settings to defaults? This will clear your writing style and signature.");
    if (!confirmReset) return;

    setResetting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userEmail,
          schema: null // Reset all settings
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Settings reset to defaults!" });
        // Refresh settings after reset
        await fetchSettings();
      } else {
        setMessage({ type: "error", text: "Failed to reset settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to reset settings" });
    } finally {
      setResetting(false);
    }
  }

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
              Please sign in to access draft settings.
            </p>
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
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">Draft Settings</h1>
          <p className="text-sm text-[var(--text-muted)] sm:text-base">
            Configure how AI generates draft responses for your emails
          </p>
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
            {/* Auto-Generate Drafts */}
            <section className="glass-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                    <Sparkles className="h-5 w-5 text-[var(--accent)]" />
                    Auto-Generate Drafts
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Automatically create draft responses for emails marked as
                    &quot;To Respond&quot;
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      drafts_enabled: !prev.drafts_enabled,
                    }))
                  }
                  className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors sm:h-6 sm:w-11 ${
                    settings.drafts_enabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform sm:h-4 sm:w-4 ${
                      settings.drafts_enabled ? "translate-x-7 sm:translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </section>

            {/* Response Style */}
            <section className="glass-card p-4 sm:p-6">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Response Style
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Choose how detailed your AI-generated draft responses should be
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, response_style: "concise" }))
                  }
                  className={`min-h-[64px] rounded-xl border-2 p-4 text-left transition-all sm:min-h-0 ${
                    settings.response_style === "concise"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Concise
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Short & direct. Gets to the point quickly.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, response_style: "balanced" }))
                  }
                  className={`min-h-[64px] rounded-xl border-2 p-4 text-left transition-all sm:min-h-0 ${
                    settings.response_style === "balanced"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Balanced
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Natural length. Adjusts based on context.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, response_style: "detailed" }))
                  }
                  className={`min-h-[64px] rounded-xl border-2 p-4 text-left transition-all sm:min-h-0 ${
                    settings.response_style === "detailed"
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Detailed
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Thorough responses when depth is needed.
                  </div>
                </button>
              </div>
            </section>

            {/* Writing Style */}
            <section className="glass-card p-4 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)] sm:text-lg">
                    <PenTool className="h-5 w-5 text-[var(--accent)]" />
                    Writing Style
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Learn from your sent emails to match your writing style
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      use_writing_style: !prev.use_writing_style,
                    }))
                  }
                  disabled={!settings.writing_style}
                  className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors sm:h-6 sm:w-11 ${
                    settings.use_writing_style && settings.writing_style
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--border)]"
                  } ${!settings.writing_style ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform sm:h-4 sm:w-4 ${
                      settings.use_writing_style && settings.writing_style
                        ? "translate-x-7 sm:translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {settings.writing_style ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-3 sm:p-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Your Writing Style Summary
                    </h3>
                    <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                      {settings.writing_style}
                    </p>
                  </div>
                  <button
                    onClick={analyzeWritingStyle}
                    disabled={analyzing}
                    className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] sm:min-h-0 sm:py-2"
                  >
                    {analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Re-analyze Style
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-[var(--border)] p-6 text-center sm:p-8">
                  <PenTool className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    Analyze your sent emails to learn your unique writing style
                  </p>
                  <button
                    onClick={analyzeWritingStyle}
                    disabled={analyzing}
                    className="mx-auto mt-4 flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--accent-hover)] hover:shadow-md hover:shadow-[var(--accent)]/10 disabled:opacity-50 sm:min-h-0 sm:py-2"
                  >
                    {analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Analyze My Writing Style
                  </button>
                </div>
              )}
            </section>

            {/* Email Signature */}
            <section className="glass-card p-4 sm:p-6">
              <div className="mb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Email Signature
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                      HTML Supported
                    </span>
                    {settings.signature && (
                      <button
                        type="button"
                        onClick={() => setSignaturePreview(!signaturePreview)}
                        className="flex min-h-[36px] items-center gap-1 rounded-lg px-3 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] sm:min-h-0 sm:px-2"
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
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Your signature will be appended to all generated draft responses
                </p>
              </div>

              {signaturePreview && settings.signature ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3 sm:p-4">
                  <div
                    className="prose prose-sm prose-invert max-w-none"
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
                  className="block w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 sm:px-4"
                  placeholder={`<div>
  <p>Best regards,</p>
  <p><strong>Your Name</strong></p>
  <p>Your Company | your@email.com</p>
</div>`}
                />
              )}
            </section>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={resetToDefaults}
                disabled={resetting || saving}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-4 text-base font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-50 sm:min-h-0 sm:py-3"
              >
                {resetting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RotateCcw className="h-5 w-5" />
                )}
                Reset to Defaults
              </button>
              
              <button
                onClick={handleSave}
                disabled={saving || resetting}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-4 text-base font-medium text-white transition-all hover:bg-[var(--accent-hover)] hover:shadow-md hover:shadow-[var(--accent)]/10 disabled:opacity-50 sm:min-h-0 sm:py-3"
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
        </div>
      </main>
    </div>
  );
}
