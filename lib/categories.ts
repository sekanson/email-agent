/**
 * Shared category configuration - Single source of truth
 * All pages should import from here to ensure consistency
 */

export interface CategoryConfig {
  name: string;
  color: string;
  enabled: boolean;
  required?: boolean;
  description: string;
  rules?: string;
  drafts?: boolean;
  order: number;
}

// Bright/light colors for good contrast on dark theme
export const CATEGORY_COLORS = {
  red: "#F87171",      // Red-400 - To Respond
  orange: "#FB923C",   // Orange-400 - FYI
  cyan: "#22D3EE",     // Cyan-400 - Comment
  green: "#4ADE80",    // Green-400 - Notification
  purple: "#A855F7",   // Purple-400 - Meeting/Calendar
  blue: "#60A5FA",     // Blue-400 - Awaiting Reply
  teal: "#2DD4BF",     // Teal-400 - Actioned
  pink: "#F472B6",     // Pink-400 - Marketing
  gray: "#9CA3AF",     // Gray-400 - Other
};

// Default category configuration
export const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": {
    name: "To Respond",
    color: CATEGORY_COLORS.red,
    enabled: true,
    required: true,
    description: "Requires your reply or action",
    rules: "",
    drafts: true,
    order: 1,
  },
  "2": {
    name: "FYI",
    color: CATEGORY_COLORS.orange,
    enabled: true,
    description: "Worth knowing, no response required",
    rules: "",
    drafts: false,
    order: 2,
  },
  "3": {
    name: "Comment",
    color: CATEGORY_COLORS.cyan,
    enabled: true,
    description: "Mentions from docs, threads & chats",
    rules: "",
    drafts: false,
    order: 3,
  },
  "4": {
    name: "Notification",
    color: CATEGORY_COLORS.green,
    enabled: true,
    description: "Automated alerts & confirmations",
    rules: "",
    drafts: false,
    order: 4,
  },
  "5": {
    name: "Meeting",
    color: CATEGORY_COLORS.purple,
    enabled: true,
    description: "Meetings, invites & calendar events",
    rules: "",
    drafts: false,
    order: 5,
  },
  "6": {
    name: "Awaiting Reply",
    color: CATEGORY_COLORS.blue,
    enabled: true,
    description: "Waiting on someone else's response",
    rules: "",
    drafts: false,
    order: 6,
  },
  "7": {
    name: "Actioned",
    color: CATEGORY_COLORS.teal,
    enabled: true,
    description: "Resolved or finished conversations",
    rules: "",
    drafts: false,
    order: 7,
  },
  "8": {
    name: "Marketing",
    color: CATEGORY_COLORS.pink,
    enabled: true,
    description: "Newsletters, sales & promotional",
    rules: "",
    drafts: false,
    order: 8,
  },
};

// Helper to get category by number
export function getCategory(categories: Record<string, CategoryConfig> | null | undefined, num: number | string): CategoryConfig | null {
  const cats = categories || DEFAULT_CATEGORIES;
  return cats[num.toString()] || null;
}

// Helper to get category color
export function getCategoryColor(categories: Record<string, CategoryConfig> | null | undefined, num: number | string): string {
  const cat = getCategory(categories, num);
  return cat?.color || CATEGORY_COLORS.gray;
}

// Helper to get category name (strips number prefix if present)
export function getCategoryName(categories: Record<string, CategoryConfig> | null | undefined, num: number | string): string {
  const cat = getCategory(categories, num);
  if (!cat) return `Category ${num}`;
  // Strip any number prefix like "1: " from the name
  return cat.name.replace(/^\d+:\s*/, "");
}

// Helper to get display name with number prefix
export function getCategoryDisplayName(categories: Record<string, CategoryConfig> | null | undefined, num: number | string): string {
  const name = getCategoryName(categories, num);
  return `${num}: ${name}`;
}

// Preset color options for color picker (all light/bright)
export const COLOR_PRESETS = [
  "#F87171", // Red
  "#FB923C", // Orange
  "#FBBF24", // Amber
  "#A3E635", // Lime
  "#4ADE80", // Green
  "#2DD4BF", // Teal
  "#22D3EE", // Cyan
  "#60A5FA", // Blue
  "#818CF8", // Indigo
  "#A855F7", // Purple
  "#E879F9", // Fuchsia
  "#F472B6", // Pink
];
