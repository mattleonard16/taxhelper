/**
 * Shared constants for the application
 */

import { TransactionType } from "@/types";

// Type labels for display
export const TYPE_LABELS: Record<TransactionType, string> = {
  SALES_TAX: "Sales Tax",
  INCOME_TAX: "Income Tax",
  OTHER: "Other",
};

// Short type labels for compact displays
export const TYPE_LABELS_SHORT: Record<TransactionType, string> = {
  SALES_TAX: "Sales",
  INCOME_TAX: "Income",
  OTHER: "Other",
};

// Type colors for badges and charts
export const TYPE_COLORS: Record<TransactionType, string> = {
  SALES_TAX: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  INCOME_TAX: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  OTHER: "bg-chart-3/20 text-chart-3 border-chart-3/30",
};

// Supported currencies
export const CURRENCIES = [
  { code: "USD", label: "US Dollar ($)", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "CAD", label: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific Time (America/Los_Angeles)" },
  { value: "America/Denver", label: "Mountain Time (America/Denver)" },
  { value: "America/Phoenix", label: "Arizona Time (America/Phoenix)" },
  { value: "America/Chicago", label: "Central Time (America/Chicago)" },
  { value: "America/New_York", label: "Eastern Time (America/New_York)" },
  { value: "America/Anchorage", label: "Alaska Time (America/Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (Pacific/Honolulu)" },
  { value: "Europe/London", label: "London (Europe/London)" },
  { value: "Europe/Paris", label: "Central Europe (Europe/Paris)" },
  { value: "Europe/Berlin", label: "Berlin (Europe/Berlin)" },
  { value: "Asia/Tokyo", label: "Tokyo (Asia/Tokyo)" },
  { value: "Asia/Shanghai", label: "Shanghai (Asia/Shanghai)" },
  { value: "Asia/Kolkata", label: "India (Asia/Kolkata)" },
  { value: "Australia/Sydney", label: "Sydney (Australia/Sydney)" },
  { value: "UTC", label: "UTC" },
] as const;

export type TimeZoneId = (typeof TIMEZONES)[number]["value"];
