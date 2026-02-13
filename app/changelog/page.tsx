"use client";

import { useEffect, useState } from "react";

interface Commit {
  hash: string;
  fullHash: string;
  date: string;
  day: string;
  message: string;
  type: string;
}

interface ChangelogDay {
  day: string;
  commits: Commit[];
}

interface Changelog {
  generated: string;
  commitCount: number;
  days: ChangelogDay[];
}

const typeColors: Record<string, string> = {
  feature: "bg-green-500/20 text-green-400",
  fix: "bg-blue-500/20 text-blue-400",
  security: "bg-red-500/20 text-red-400",
  debug: "bg-yellow-500/20 text-yellow-400",
  ui: "bg-purple-500/20 text-purple-400",
  other: "bg-gray-500/20 text-gray-400",
};

const typeLabels: Record<string, string> = {
  feature: "Feature",
  fix: "Fix",
  security: "Security",
  debug: "Debug",
  ui: "UI",
  other: "Other",
};

export default function ChangelogPage() {
  const [changelog, setChangelog] = useState<Changelog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/changelog.json")
      .then((r) => {
        if (!r.ok) throw new Error("Changelog not found");
        return r.json();
      })
      .then(setChangelog)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-muted)]">No changelog available.</p>
      </div>
    );
  }

  if (!changelog) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading changelog...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Changelog
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {changelog.commitCount} changes tracked &middot; Built{" "}
          {new Date(changelog.generated).toLocaleDateString()}
        </p>
      </div>

      <div className="space-y-8">
        {changelog.days.map((day) => (
          <div key={day.day}>
            <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">
              {formatDate(day.day)}
            </h2>
            <div className="space-y-2">
              {day.commits.map((commit) => (
                <div
                  key={commit.hash}
                  className="flex items-start gap-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-3"
                >
                  <span
                    className={`mt-0.5 inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${typeColors[commit.type] || typeColors.other}`}
                  >
                    {typeLabels[commit.type] || "Other"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text-primary)]">
                      {cleanMessage(commit.message)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      <code className="rounded bg-[var(--bg-elevated)] px-1 py-0.5 font-mono">
                        {commit.hash}
                      </code>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function cleanMessage(msg: string): string {
  // Strip conventional commit prefix for cleaner display
  return msg.replace(/^(feat|fix|debug|security|ui|chore|refactor|docs|test|style|perf|ci|build|revert)(\(.+?\))?:\s*/i, "");
}
