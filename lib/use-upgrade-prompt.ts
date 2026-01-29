/**
 * Hook for managing upgrade prompts
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { 
  CURRENT_SCHEMA_VERSIONS, 
  needsUpgradePrompt, 
  hasSeenUpgradePrompt,
  getUserSchemaVersion,
  getUpgradePromptKey,
  detectCategoriesVersion,
  type SchemaKey 
} from "./schema-versions";
import type { UserSettings } from "./settings-merge";

export interface UpgradeInfo {
  schema: SchemaKey;
  fromVersion: string;
  toVersion: string;
  needsPrompt: boolean;
}

// LocalStorage key for persisting dismissed prompts
const DISMISSED_PROMPTS_KEY = 'zeno_dismissed_upgrade_prompts';

// Helper to get dismissed prompts from localStorage
function getDismissedFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(DISMISSED_PROMPTS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

// Helper to save dismissed prompts to localStorage
function saveDismissedToStorage(dismissed: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISSED_PROMPTS_KEY, JSON.stringify([...dismissed]));
  } catch {
    // Ignore storage errors
  }
}

export function useUpgradePrompt(userSettings: UserSettings | null) {
  const [pendingUpgrades, setPendingUpgrades] = useState<UpgradeInfo[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<UpgradeInfo | null>(null);
  
  // Track prompts dismissed - combines session memory AND localStorage persistence
  const dismissedPrompts = useRef<Set<string>>(getDismissedFromStorage());

  useEffect(() => {
    if (!userSettings) {
      setPendingUpgrades([]);
      setCurrentPrompt(null);
      return;
    }

    const upgrades: UpgradeInfo[] = [];

    // Check each schema for needed upgrades
    for (const [schema, currentVersion] of Object.entries(CURRENT_SCHEMA_VERSIONS)) {
      let userVersion = getUserSchemaVersion(userSettings.schemaVersions, schema as SchemaKey);
      
      // For categories, detect version from actual data if schemaVersions is missing
      // This handles cases where the schemaVersions column doesn't exist in the DB
      if (schema === 'categories' && !userSettings.schemaVersions?.categories) {
        userVersion = detectCategoriesVersion(userSettings.categories);
      }
      
      const needsUpgrade = needsUpgradePrompt(userVersion, currentVersion);
      const promptKey = getUpgradePromptKey(schema as SchemaKey, currentVersion);
      const seenPrompt = hasSeenUpgradePrompt(
        userSettings.upgradePromptsShown, 
        schema as SchemaKey, 
        currentVersion
      );
      
      // Check localStorage/session dismissal (handles DB save failures)
      const dismissedLocally = dismissedPrompts.current.has(promptKey);

      if (needsUpgrade && !seenPrompt && !dismissedLocally) {
        upgrades.push({
          schema: schema as SchemaKey,
          fromVersion: userVersion,
          toVersion: currentVersion,
          needsPrompt: true,
        });
      }
    }

    setPendingUpgrades(upgrades);
    
    // Show the first pending upgrade as current prompt
    setCurrentPrompt(upgrades.length > 0 ? upgrades[0] : null);
  }, [userSettings]);

  const dismissCurrentPrompt = useCallback(() => {
    if (currentPrompt) {
      // Track as dismissed - both in memory AND localStorage
      const promptKey = getUpgradePromptKey(currentPrompt.schema, currentPrompt.toVersion);
      dismissedPrompts.current.add(promptKey);
      saveDismissedToStorage(dismissedPrompts.current);
      
      // Remove the current prompt from pending list
      const remainingUpgrades = pendingUpgrades.filter(
        upgrade => upgrade.schema !== currentPrompt.schema
      );
      setPendingUpgrades(remainingUpgrades);
      setCurrentPrompt(remainingUpgrades.length > 0 ? remainingUpgrades[0] : null);
    }
  }, [currentPrompt, pendingUpgrades]);

  const handleUpgradeAction = useCallback(async (
    userEmail: string,
    action: 'upgrade' | 'keep' | 'dismiss'
  ): Promise<boolean> => {
    if (!currentPrompt) return false;

    // Immediately dismiss locally AND persist to localStorage
    const promptKey = getUpgradePromptKey(currentPrompt.schema, currentPrompt.toVersion);
    dismissedPrompts.current.add(promptKey);
    saveDismissedToStorage(dismissedPrompts.current);

    try {
      const response = await fetch('/api/settings/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail,
          schema: currentPrompt.schema,
          action,
          fromVersion: currentPrompt.fromVersion,
          toVersion: currentPrompt.toVersion,
        }),
      });

      if (response.ok) {
        dismissCurrentPrompt();
        return true;
      } else {
        console.error('Failed to handle upgrade action');
        // Still dismiss the prompt locally even if API failed
        dismissCurrentPrompt();
        return false;
      }
    } catch (error) {
      console.error('Error handling upgrade action:', error);
      // Still dismiss the prompt locally even if API failed
      dismissCurrentPrompt();
      return false;
    }
  }, [currentPrompt, dismissCurrentPrompt]);

  return {
    currentPrompt,
    pendingUpgrades,
    hasUpgrades: pendingUpgrades.length > 0,
    dismissCurrentPrompt,
    handleUpgradeAction,
  };
}