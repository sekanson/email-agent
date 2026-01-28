/**
 * Schema Versioning System - Single Source of Truth
 * 
 * This file manages schema versions and changelogs for all user settings.
 * When defaults change, increment the version and add changelog entry.
 */

// Current schema versions
export const CURRENT_SCHEMA_VERSIONS = {
  categories: "v2", // Upgraded to v2 with improved default categories
  draftTemplates: "v1", // Future feature
  notifications: "v1", // Future feature
} as const;

// Type for schema version keys
export type SchemaKey = keyof typeof CURRENT_SCHEMA_VERSIONS;

// Schema version changelog - what changed in each version
export const SCHEMA_CHANGELOGS = {
  categories: {
    v1: {
      version: "v1",
      description: "Original category system",
      changes: [
        "Basic 8 category system",
        "Simple color coding",
        "Manual drafting rules"
      ]
    },
    v2: {
      version: "v2", 
      description: "Enhanced categories with better defaults",
      changes: [
        "Improved category names for clarity",
        "Better color scheme alignment",
        "Optimized drafting rules",
        "Enhanced order priority"
      ]
    }
  },
  draftTemplates: {
    v1: {
      version: "v1",
      description: "Basic draft template system", 
      changes: [
        "Simple template structure",
        "Basic personalization"
      ]
    }
  },
  notifications: {
    v1: {
      version: "v1",
      description: "Basic notification preferences",
      changes: [
        "Timezone support",
        "Quiet hours configuration"
      ]
    }
  }
} as const;

// Helper type for version info
export interface VersionInfo {
  version: string;
  description: string;
  changes: string[];
}

// Get changelog for a specific schema and version
export function getSchemaChangelog(schema: SchemaKey, version: string): VersionInfo | null {
  const schemaChangelog = SCHEMA_CHANGELOGS[schema];
  if (!schemaChangelog || !(version in schemaChangelog)) {
    return null;
  }
  return (schemaChangelog as any)[version];
}

// Check if user needs upgrade prompt for a schema
export function needsUpgradePrompt(
  userSchemaVersion: string | undefined,
  currentVersion: string
): boolean {
  // No user version means they're new or on v1
  if (!userSchemaVersion) {
    return currentVersion !== "v1";
  }
  
  // Compare versions (simple string comparison works for our v1, v2, v3 format)
  return userSchemaVersion < currentVersion;
}

// Get the user's effective version (default to v1 if not set)
export function getUserSchemaVersion(
  userSchemaVersions: Record<string, string> | undefined | null,
  schema: SchemaKey
): string {
  return userSchemaVersions?.[schema] || "v1";
}

// Check if user has seen upgrade prompt
export function hasSeenUpgradePrompt(
  upgradePromptsShown: Record<string, boolean> | undefined | null,
  schema: SchemaKey,
  version: string
): boolean {
  const key = `${schema}_${version}`;
  return upgradePromptsShown?.[key] || false;
}

// Generate key for tracking upgrade prompts
export function getUpgradePromptKey(schema: SchemaKey, version: string): string {
  return `${schema}_${version}`;
}