"use client";

import { useState } from "react";
import { X, Sparkles, ArrowRight, Info } from "lucide-react";
import { 
  getSchemaChangelog, 
  getUpgradePromptKey, 
  type SchemaKey, 
  type VersionInfo 
} from "@/lib/schema-versions";

interface UpgradePromptProps {
  schema: SchemaKey;
  fromVersion: string;
  toVersion: string;
  userEmail: string;
  onUpgrade: () => Promise<void | boolean>;
  onDismiss: () => Promise<void | boolean>;
  onKeepCurrent: () => Promise<void | boolean>;
}

export default function UpgradePrompt({
  schema,
  fromVersion,
  toVersion,
  userEmail,
  onUpgrade,
  onDismiss,
  onKeepCurrent,
}: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const changelog = getSchemaChangelog(schema, toVersion);
  const schemaDisplayName = getSchemaDisplayName(schema);

  if (!changelog) {
    return null; // Don't show prompt if no changelog available
  }

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
    } catch (error) {
      console.error("Upgrade prompt action failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-blue-500/20 bg-gray-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white">We&apos;ve improved {schemaDisplayName}!</h3>
              <p className="text-sm text-gray-400">
                Upgrade from {fromVersion} → {toVersion}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleAction(onDismiss)}
            disabled={loading}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-4 text-gray-300">
          {changelog.description}
        </p>

        {/* Show details toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mb-4 flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
        >
          <Info className="h-3 w-3" />
          {showDetails ? "Hide details" : "What's new?"}
        </button>

        {/* Detailed changes */}
        {showDetails && (
          <div className="mb-4 rounded-lg bg-gray-800/50 p-3">
            <p className="mb-2 text-sm font-medium text-gray-300">Improvements in {toVersion}:</p>
            <ul className="space-y-1">
              {changelog.changes.map((change, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="mt-1 h-1 w-1 rounded-full bg-blue-400" />
                  {change}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleAction(onUpgrade)}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                Upgrading...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Upgrade to {toVersion}
              </>
            )}
          </button>
          
          <button
            onClick={() => handleAction(onKeepCurrent)}
            disabled={loading}
            className="rounded-lg border border-gray-600 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
          >
            Keep my current setup
          </button>
        </div>

        {/* Footer note */}
        <p className="mt-3 text-xs text-gray-500">
          You can always reset to defaults later in settings.
        </p>
      </div>
    </div>
  );
}

// Helper to get user-friendly schema names
function getSchemaDisplayName(schema: SchemaKey): string {
  switch (schema) {
    case 'categories':
      return 'Email Categories';
    case 'draftTemplates':
      return 'Draft Templates';
    case 'notifications':
      return 'Notification Settings';
    default:
      return schema;
  }
}