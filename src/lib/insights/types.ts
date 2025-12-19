/**
 * Insight types for TaxHelper analytics
 */

export const INSIGHT_TYPES = {
  QUIET_LEAK: 'QUIET_LEAK',
  TAX_DRAG: 'TAX_DRAG',
  SPIKE: 'SPIKE',
  DUPLICATE: 'DUPLICATE',
} as const;

export type InsightType = (typeof INSIGHT_TYPES)[keyof typeof INSIGHT_TYPES];

export interface Insight {
  id?: string;
  type: InsightType;
  title: string;
  summary: string;
  severityScore: number; // 1-10
  supportingTransactionIds: string[];
  dismissed?: boolean;
  pinned?: boolean;
}

// Thresholds for insight detection
export const QUIET_LEAK_THRESHOLDS = {
  MIN_OCCURRENCES: 3,
  MAX_INDIVIDUAL_AMOUNT: 20,
  MIN_CUMULATIVE_TOTAL: 50,
  SEVERITY_DIVISOR: 25,
} as const;

export const TAX_DRAG_THRESHOLDS = {
  MIN_TAX_RATE: 0.09, // 9%
  MIN_TOTAL_SPENT: 100,
  BASELINE_RATE: 0.08, // 8% baseline for severity calc
  SEVERITY_MULTIPLIER: 100,
} as const;

export const SPIKE_THRESHOLDS = {
  AVERAGE_MULTIPLIER: 2,
  DUPLICATE_WINDOW_HOURS: 24,
  SEVERITY_MULTIPLIER: 2,
} as const;
