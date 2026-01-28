import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";

// Merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number, currency: string = "GEL"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "GEL" ? "GEL" : currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Format date for display
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return format(date, "MMM d, yyyy");
}

// Format date with time
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return format(date, "MMM d, yyyy 'at' HH:mm");
}

// Format relative date
export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  if (isThisWeek(date)) {
    return format(date, "EEEE");
  }
  if (isThisMonth(date)) {
    return format(date, "MMM d");
  }
  return format(date, "MMM d, yyyy");
}

// Get date group for transactions
export function getDateGroup(timestamp: number): string {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  if (isThisWeek(date)) {
    return "This Week";
  }
  if (isThisMonth(date)) {
    return "This Month";
  }
  return format(date, "MMMM yyyy");
}

// Format time ago
export function formatTimeAgo(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

// Calculate percentage change
export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// Group array by key
export function groupBy<T>(array: T[], key: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const group = key(item);
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

// Default categories
export const DEFAULT_CATEGORIES = [
  { name: "Food & Dining", color: "#ef4444", icon: "utensils" },
  { name: "Transport", color: "#3b82f6", icon: "car" },
  { name: "Shopping", color: "#8b5cf6", icon: "shopping-bag" },
  { name: "Entertainment", color: "#ec4899", icon: "film" },
  { name: "Subscriptions", color: "#06b6d4", icon: "repeat" },
  { name: "Utilities", color: "#84cc16", icon: "zap" },
  { name: "Healthcare", color: "#14b8a6", icon: "heart" },
  { name: "Other", color: "#6b7280", icon: "more-horizontal" },
];

// Merchant category patterns
export const MERCHANT_PATTERNS: Record<string, string> = {
  "bolt": "Transport",
  "uber": "Transport",
  "glovo": "Food & Dining",
  "wolt": "Food & Dining",
  "spotify": "Subscriptions",
  "netflix": "Subscriptions",
  "google": "Subscriptions",
  "apple": "Subscriptions",
};

// Auto-categorize based on merchant name
export function autoCategorize(merchant: string | null | undefined): string {
  if (!merchant) return "Other";

  const lowerMerchant = merchant.toLowerCase();

  for (const [pattern, category] of Object.entries(MERCHANT_PATTERNS)) {
    if (lowerMerchant.includes(pattern)) {
      return category;
    }
  }

  return "Other";
}
