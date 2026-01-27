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

// Gmail-compatible label colors (these exact values are accepted by Gmail API)
export const CATEGORY_COLORS = {
  red: "#fb4c2f",       // Gmail Red - To Respond
  orange: "#ffad47",    // Gmail Orange - FYI
  cyan: "#2da2bb",      // Gmail Cyan - Comment
  green: "#43d692",     // Gmail Light Green - Notification
  purple: "#a479e2",    // Gmail Purple - Meeting/Calendar
  blue: "#4a86e8",      // Gmail Blue - Awaiting Reply
  teal: "#16a766",      // Gmail Green - Actioned
  pink: "#f691b3",      // Gmail Pink - Marketing
  gray: "#4a86e8",      // Gmail Blue (no gray in Gmail) - Other
};

// Default category configuration (names differentiated from Fyxer)
export const DEFAULT_CATEGORIES: Record<string, CategoryConfig> = {
  "1": {
    name: "Reply Needed",
    color: CATEGORY_COLORS.red,
    enabled: true,
    required: true,
    description: "Requires your reply or action",
    rules: "",
    drafts: true,
    order: 1,
  },
  "2": {
    name: "For Info",
    color: CATEGORY_COLORS.orange,
    enabled: true,
    description: "Worth knowing, no response required",
    rules: "",
    drafts: false,
    order: 2,
  },
  "3": {
    name: "Mentions",
    color: CATEGORY_COLORS.cyan,
    enabled: true,
    description: "Mentions from docs, threads & chats",
    rules: "",
    drafts: false,
    order: 3,
  },
  "4": {
    name: "Alerts",
    color: CATEGORY_COLORS.green,
    enabled: true,
    description: "Automated alerts & confirmations",
    rules: "",
    drafts: false,
    order: 4,
  },
  "5": {
    name: "Calendar",
    color: CATEGORY_COLORS.purple,
    enabled: true,
    description: "Meetings, invites & calendar events",
    rules: "",
    drafts: false,
    order: 5,
  },
  "6": {
    name: "Waiting",
    color: CATEGORY_COLORS.blue,
    enabled: true,
    description: "Waiting on someone else's response",
    rules: "",
    drafts: false,
    order: 6,
  },
  "7": {
    name: "Actioned!",
    color: CATEGORY_COLORS.teal,
    enabled: true,
    description: "Resolved or finished conversations",
    rules: "",
    drafts: false,
    order: 7,
  },
  "8": {
    name: "Ad/Spam",
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

// Gmail-compatible color presets (these exact values work with Gmail's label API)
export const COLOR_PRESETS = [
  "#fb4c2f", // Red
  "#cc3a21", // Dark Red
  "#ffad47", // Orange
  "#fad165", // Yellow
  "#16a766", // Green
  "#43d692", // Light Green
  "#4a86e8", // Blue
  "#a479e2", // Purple
  "#f691b3", // Pink
  "#2da2bb", // Cyan
  "#b99aff", // Light Purple
  "#ff7537", // Orange Red
];
