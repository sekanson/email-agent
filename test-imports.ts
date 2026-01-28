// Quick test file to verify imports
import { CURRENT_SCHEMA_VERSIONS } from "./lib/schema-versions";
import { mergeUserSettingsWithDefaults } from "./lib/settings-merge";
import { DEFAULT_CATEGORIES } from "./lib/categories";

console.log("All imports working:", {
  versions: CURRENT_SCHEMA_VERSIONS,
  categories: Object.keys(DEFAULT_CATEGORIES).length
});