/**
 * Shared type definitions for the application
 * These types represent the API response shapes
 */

// Import and re-export TransactionType and TransactionPriority from schemas (single source of truth)
import type { TransactionType as TransactionTypeSchema, TransactionPriority as TransactionPrioritySchema } from "@/lib/schemas";
export type TransactionType = TransactionTypeSchema;
export type TransactionPriority = TransactionPrioritySchema;

// Transaction type from API responses
export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  description: string | null;
  merchant: string | null;
  totalAmount: string;
  taxAmount: string;
  currency?: string;
  priority?: TransactionPriority;
}

// Template type from API responses
export interface Template {
  id: string;
  label: string;
  merchant: string | null;
  taxRate: string;
  type: TransactionType;
  isDefault: boolean;
}

// Summary data from dashboard API
export interface Summary {
  totalTax: string;
  totalSpent: string;
  taxShare: number;
  todayTax: string;
  avgDailyTax: string;
  daysTracked: number;
  byType: {
    SALES_TAX: string;
    INCOME_TAX: string;
    OTHER: string;
  };
  byTypeTotals: {
    SALES_TAX: string;
    INCOME_TAX: string;
    OTHER: string;
  };
  timeseries: TimeseriesPoint[];
  topMerchants: MerchantTotal[];
  transactionCount: number;
}

export interface TimeseriesPoint {
  date: string;
  tax: string;
}

export interface MerchantTotal {
  merchant: string;
  tax: string;
}

// Pagination response from API
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// User settings from API
export interface UserSettings {
  name: string | null;
  email: string | null;
  country: string | null;
  state: string | null;
  defaultTaxRate: string | null;
  currency: string;
  timezone: string;
}
