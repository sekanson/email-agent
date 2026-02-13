/**
 * Settings Safe Merge Utilities
 * 
 * Provides deep merge functions that prioritize user data over defaults.
 * Ensures existing user settings are never overwritten by new defaults.
 */

import { DEFAULT_CATEGORIES_V1, DEFAULT_CATEGORIES_V2, DEFAULT_CATEGORIES, type CategoryConfig } from "./categories";
import { CURRENT_SCHEMA_VERSIONS, getUserSchemaVersion, type SchemaKey } from "./schema-versions";

// Default settings (server-side single source of truth)
export const DEFAULT_USER_SETTINGS = {
  // Draft generation settings
  temperature: 0.7,
  signature: "",
  drafts_enabled: true,
  use_writing_style: false,
  writing_style: "",
  categories: DEFAULT_CATEGORIES,
  
  // Auto-polling settings
  auto_poll_enabled: false,
  auto_poll_interval: 120,
  
  // Zeno assistant settings
  zeno_digest_enabled: true,
  zeno_digest_types: ["morning", "eod", "weekly"],
  zeno_morning_time: "09:00",
  zeno_eod_time: "18:00",
  vip_senders: [],
  focus_mode_enabled: false,
  focus_mode_until: null,
  timezone: "America/New_York",
  zeno_confirmations: true,
  
  // Schema versioning - defaults to v1 so existing users see upgrade prompts
  // New users will get prompted to upgrade from v1 to v2
  schemaVersions: { categories: 'v1', draftTemplates: 'v1', notifications: 'v1' } as Record<SchemaKey, string>,
  upgradePromptsShown: {},
} as const;

export type UserSettings = typeof DEFAULT_USER_SETTINGS & {
  schemaVersions?: Partial<Record<SchemaKey, string>>;
  upgradePromptsShown?: Record<string, boolean>;
  [key: string]: any; // Allow for additional user fields
};

/**
 * Deep merge two objects, with user data taking precedence
 * @param defaults - Default values
 * @param user - User values (takes precedence)
 * @returns Merged object with user values overriding defaults
 */
export function deepMerge<T extends Record<string, any>>(defaults: T, user: Partial<T>): T {
  const result = { ...defaults } as T;
  
  for (const key in user) {
    if (user[key] !== undefined && user[key] !== null) {
      if (typeof user[key] === 'object' && !Array.isArray(user[key]) && user[key] !== null) {
        // Deep merge objects (but not arrays or null values)
        if (typeof defaults[key] === 'object' && !Array.isArray(defaults[key]) && defaults[key] !== null) {
          (result as any)[key] = deepMerge(defaults[key] as any, user[key] as any);
        } else {
          (result as any)[key] = user[key];
        }
      } else {
        // Direct assignment for primitives, arrays, and null values
        (result as any)[key] = user[key];
      }
    }
  }
  
  return result;
}

/**
 * Get appropriate default categories based on user's schema version
 * @param userSchemaVersions - User's schema versions
 * @returns Categories for the user's version
 */
export function getCategoriesForUserVersion(
  userSchemaVersions?: Partial<Record<SchemaKey, string>>
): Record<string, CategoryConfig> {
  const userCategoriesVersion = getUserSchemaVersion(userSchemaVersions, 'categories');
  
  switch (userCategoriesVersion) {
    case 'v1':
      return DEFAULT_CATEGORIES_V1;
    case 'v2':
    default:
      return DEFAULT_CATEGORIES_V2;
  }
}

/**
 * Safely merge user settings with defaults, preserving user data
 * @param userSettings - Existing user settings from database
 * @returns Merged settings with all defaults filled in, user data preserved
 */
export function mergeUserSettingsWithDefaults(userSettings?: Partial<UserSettings>): UserSettings {
  if (!userSettings) {
    return { ...DEFAULT_USER_SETTINGS };
  }

  // Get appropriate categories based on user's version
  const userCategories = getCategoriesForUserVersion(userSettings.schemaVersions);
  const defaultsWithUserCategories = {
    ...DEFAULT_USER_SETTINGS,
    categories: userCategories
  };

  // Extract user categories before merge - if user has saved categories,
  // use them as-is (don't fill in deleted keys from defaults).
  // Only fall back to defaults when user has NO categories at all.
  const userHasCategories = userSettings.categories && 
    typeof userSettings.categories === 'object' && 
    Object.keys(userSettings.categories).length > 0;

  // Deep merge, with user settings taking precedence
  const merged = deepMerge(defaultsWithUserCategories, userSettings);

  // Override: if user had their own categories, use those exactly (no zombie defaults)
  if (userHasCategories) {
    (merged as any).categories = userSettings.categories as Record<string, CategoryConfig>;
  }
  
  // Ensure schemaVersions is properly initialized
  if (!merged.schemaVersions) {
    merged.schemaVersions = { categories: 'v1', draftTemplates: 'v1', notifications: 'v1' };
  }
  
  // Ensure upgradePromptsShown is properly initialized
  if (!merged.upgradePromptsShown) {
    merged.upgradePromptsShown = {};
  }

  return merged;
}

/**
 * Check if any settings are missing defaults and add them without overwriting
 * @param currentSettings - Current user settings 
 * @returns Updated settings with any missing defaults added
 */
export function addMissingDefaults(currentSettings: UserSettings): UserSettings {
  return deepMerge(DEFAULT_USER_SETTINGS, currentSettings);
}