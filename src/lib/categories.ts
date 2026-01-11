/**
 * Centralized category code definitions
 * Single source of truth for all category-related constants
 * 
 * This file consolidates category codes that were previously scattered across:
 * - LLM prompts (receipt-llm.ts, llm-service.ts)
 * - Validation schemas (schemas.ts)
 * - UI components (bulk-actions-bar.tsx, filter-chips.tsx, category-breakdown-chart.tsx)
 * - API routes (batch/route.ts)
 */

// All valid category codes (includes both LLM outputs and legacy codes)
export const CATEGORY_CODES = [
  'MEALS',        // Meals & Entertainment
  'TRAVEL',       // Travel  
  'OFFICE',       // Office Supplies
  'UTILITIES',    // Utilities
  'SERVICES',     // Professional Services (LLM output)
  'PROFESSIONAL', // Professional Services (legacy/backward compat)
  'SOFTWARE',     // Software & Subscriptions
  'GROCERIES',    // Groceries
  'HEALTHCARE',   // Healthcare
  'OTHER',        // Other/Uncategorized
] as const;

export type CategoryCode = typeof CATEGORY_CODES[number];

// Human-readable labels for each code
export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  MEALS: 'Meals & Entertainment',
  TRAVEL: 'Travel',
  OFFICE: 'Office Supplies',
  UTILITIES: 'Utilities',
  SERVICES: 'Professional Services',
  PROFESSIONAL: 'Professional Services',
  SOFTWARE: 'Software & Subscriptions',
  GROCERIES: 'Groceries',
  HEALTHCARE: 'Healthcare',
  OTHER: 'Other',
};

// Chart colors for category visualization
export const CATEGORY_COLORS: Record<CategoryCode, string> = {
  MEALS: 'oklch(0.7 0.18 45)',       // Orange
  TRAVEL: 'oklch(0.6 0.2 270)',      // Purple
  OFFICE: 'oklch(0.65 0.22 150)',    // Green
  UTILITIES: 'oklch(0.65 0.18 220)', // Blue
  SERVICES: 'oklch(0.6 0.2 330)',    // Pink
  PROFESSIONAL: 'oklch(0.6 0.2 330)',// Pink (same as SERVICES)
  SOFTWARE: 'oklch(0.55 0.2 200)',   // Teal
  GROCERIES: 'oklch(0.7 0.2 100)',   // Yellow-green
  HEALTHCARE: 'oklch(0.6 0.22 0)',   // Red
  OTHER: 'oklch(0.6 0.1 250)',       // Gray-blue
};

// Default color for unknown categories
export const DEFAULT_CATEGORY_COLOR = 'oklch(0.6 0.1 250)';

// Categories to show in UI dropdowns (no duplicates - excludes PROFESSIONAL legacy code)
export const UI_CATEGORY_OPTIONS = [
  { code: 'MEALS' as const, label: 'Meals & Entertainment' },
  { code: 'TRAVEL' as const, label: 'Travel' },
  { code: 'OFFICE' as const, label: 'Office Supplies' },
  { code: 'UTILITIES' as const, label: 'Utilities' },
  { code: 'SOFTWARE' as const, label: 'Software & Subscriptions' },
  { code: 'SERVICES' as const, label: 'Professional Services' },
  { code: 'GROCERIES' as const, label: 'Groceries' },
  { code: 'HEALTHCARE' as const, label: 'Healthcare' },
  { code: 'OTHER' as const, label: 'Other' },
] as const;

// LLM prompt helper - generates the category section for LLM prompts
export const LLM_CATEGORY_PROMPT = [
  'Category Classification (pick one):',
  '- "Meals & Entertainment" (categoryCode: "MEALS") - restaurants, coffee shops, food delivery, bars',
  '- "Travel" (categoryCode: "TRAVEL") - gas, parking, rideshare, hotels, flights, tolls',
  '- "Office Supplies" (categoryCode: "OFFICE") - supplies, electronics, furniture',
  '- "Utilities" (categoryCode: "UTILITIES") - internet, phone, electricity, water',
  '- "Professional Services" (categoryCode: "SERVICES") - consulting, legal, accounting',
  '- "Software & Subscriptions" (categoryCode: "SOFTWARE") - SaaS, apps, subscriptions',
  '- "Groceries" (categoryCode: "GROCERIES") - supermarkets, food stores',
  '- "Healthcare" (categoryCode: "HEALTHCARE") - pharmacy, medical supplies, doctor visits',
  '- "Other" (categoryCode: "OTHER") - anything else',
].join('\n');

// Category codes that the LLM can output
export const LLM_VALID_CATEGORY_CODES = [
  'MEALS', 'TRAVEL', 'OFFICE', 'UTILITIES', 'SERVICES', 
  'SOFTWARE', 'GROCERIES', 'HEALTHCARE', 'OTHER'
] as const;

// Helper to get label for a category code (with fallback)
export function getCategoryLabel(code: string | null | undefined): string {
  if (!code) return 'Uncategorized';
  return CATEGORY_LABELS[code as CategoryCode] || code;
}

// Helper to get color for a category code (with fallback)
export function getCategoryColor(code: string | null | undefined): string {
  if (!code) return DEFAULT_CATEGORY_COLOR;
  return CATEGORY_COLORS[code as CategoryCode] || DEFAULT_CATEGORY_COLOR;
}
