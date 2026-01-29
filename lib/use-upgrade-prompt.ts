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
  type SchemaKey 
} from "./schema-versions";
import type { UserSettings } from "./settings-merge";

export interface UpgradeInfo {
  schema: SchemaKey;
  fromVersion: string;
  toVersion: string;
  needsPrompt: boolean;
}

export function useUpgradePrompt(userSettings: UserSettings | null) {
  const [pendingUpgrades, setPendingUpgrades] = useState<UpgradeInfo[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<UpgradeInfo | null>(null);
  
  // Track prompts dismissed this session (survives re-renders and settings refreshes)
  const dismissedThisSession = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userSettings) {
      setPendingUpgrades([]);
      setCurrentPrompt(null);
      return;
    }

    const upgrades: UpgradeInfo[] = [];

    // Check each schema for needed upgrades
    for (const [schema, currentVersion] of Object.entries(CURRENT_SCHEMA_VERSIONS)) {
      const userVersion = getUserSchemaVersion(userSettings.schemaVersions, schema as SchemaKey);
      const needsUpgrade = needsUpgradePrompt(userVersion, currentVersion);
      const promptKey = getUpgradePromptKey(schema as SchemaKey, currentVersion);
      const seenPrompt = hasSeenUpgradePrompt(
        userSettings.upgradePromptsShown, 
        schema as SchemaKey, 
        currentVersion
      );
      
      // Also check if dismissed this session (handles race conditions with DB)
      const dismissedLocally = dismissedThisSession.current.has(promptKey);

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
      // Track as dismissed this session
      const promptKey = getUpgradePromptKey(currentPrompt.schema, currentPrompt.toVersion);
      dismissedThisSession.current.add(promptKey);
      
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

    // Immediately dismiss locally to prevent re-showing on settings refresh
    const promptKey = getUpgradePromptKey(currentPrompt.schema, currentPrompt.toVersion);
    dismissedThisSession.current.add(promptKey);

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