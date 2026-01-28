/**
 * Hook for managing upgrade prompts
 */

import { useState, useEffect } from "react";
import { 
  CURRENT_SCHEMA_VERSIONS, 
  needsUpgradePrompt, 
  hasSeenUpgradePrompt,
  getUserSchemaVersion,
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
      const seenPrompt = hasSeenUpgradePrompt(
        userSettings.upgradePromptsShown, 
        schema as SchemaKey, 
        currentVersion
      );

      if (needsUpgrade && !seenPrompt) {
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

  const dismissCurrentPrompt = () => {
    if (currentPrompt) {
      // Remove the current prompt from pending list
      const remainingUpgrades = pendingUpgrades.filter(
        upgrade => upgrade.schema !== currentPrompt.schema
      );
      setPendingUpgrades(remainingUpgrades);
      setCurrentPrompt(remainingUpgrades.length > 0 ? remainingUpgrades[0] : null);
    }
  };

  const handleUpgradeAction = async (
    userEmail: string,
    action: 'upgrade' | 'keep' | 'dismiss'
  ): Promise<boolean> => {
    if (!currentPrompt) return false;

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
        return false;
      }
    } catch (error) {
      console.error('Error handling upgrade action:', error);
      return false;
    }
  };

  return {
    currentPrompt,
    pendingUpgrades,
    hasUpgrades: pendingUpgrades.length > 0,
    dismissCurrentPrompt,
    handleUpgradeAction,
  };
}