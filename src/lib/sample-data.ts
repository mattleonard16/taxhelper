/**
 * Sample data generator for onboarding
 * Creates realistic demo transactions that showcase app features
 */

import { TransactionType } from "@prisma/client";

export const DEMO_PREFIX = "[DEMO]";

interface SampleTransaction {
  date: Date;
  type: TransactionType;
  description: string;
  merchant: string;
  totalAmount: number;
  taxAmount: number;
}

// San Francisco sales tax rate
const SF_TAX_RATE = 0.08625;

// Helper to create a date N days ago at midday
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0);
  return date;
}

// Sample transaction templates
const SAMPLE_DATA: Array<{
  daysAgo: number;
  merchant: string;
  preTax: number;
  taxRate: number;
  type: TransactionType;
  desc: string;
}> = [
  // Today
  { daysAgo: 0, merchant: "Starbucks", preTax: 7.50, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Morning coffee" },
  { daysAgo: 0, merchant: "Chipotle", preTax: 14.25, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Lunch" },

  // Yesterday
  { daysAgo: 1, merchant: "Target", preTax: 67.99, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Household items" },
  { daysAgo: 1, merchant: "Amazon", preTax: 89.00, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Electronics" },

  // 2-3 days ago
  { daysAgo: 2, merchant: "Whole Foods", preTax: 52.30, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Groceries" },
  { daysAgo: 3, merchant: "Shell Gas", preTax: 58.00, taxRate: 0.0511, type: "SALES_TAX", desc: "Fuel" },
  { daysAgo: 3, merchant: "Netflix", preTax: 22.99, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Streaming subscription" },

  // 4-5 days ago - create a "quiet leak" pattern with recurring small purchases
  { daysAgo: 4, merchant: "Starbucks", preTax: 6.75, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Coffee" },
  { daysAgo: 5, merchant: "Starbucks", preTax: 7.25, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Coffee" },

  // 6-7 days ago
  { daysAgo: 6, merchant: "Best Buy", preTax: 249.99, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Headphones" },
  { daysAgo: 7, merchant: "Trader Joe's", preTax: 78.45, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Weekly groceries" },

  // Recurring quiet leak pattern (subscriptions at different merchants)
  { daysAgo: 10, merchant: "Spotify", preTax: 14.99, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Music subscription" },
  { daysAgo: 11, merchant: "Starbucks", preTax: 6.50, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Coffee" },

  // Spike - larger purchase for "anomaly" insight
  { daysAgo: 14, merchant: "Apple Store", preTax: 799.00, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "iPad" },

  // More variety
  { daysAgo: 15, merchant: "CVS Pharmacy", preTax: 24.50, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Medicine" },
  { daysAgo: 18, merchant: "Costco", preTax: 185.00, taxRate: SF_TAX_RATE, type: "SALES_TAX", desc: "Bulk shopping" },

  // Tax drag example - high tax merchant
  { daysAgo: 20, merchant: "Liquor Store", preTax: 45.00, taxRate: 0.21, type: "SALES_TAX", desc: "Wine for dinner party" },

  // Other transaction types
  { daysAgo: 25, merchant: "Uber", preTax: 32.00, taxRate: 0, type: "OTHER", desc: "Ride to airport" },
  { daysAgo: 28, merchant: "PG&E", preTax: 125.00, taxRate: 0, type: "OTHER", desc: "Electric bill" },
];

/**
 * Generates sample transactions for demo purposes
 * All transactions are prefixed with [DEMO] for identification
 */
export function generateSampleTransactions(): SampleTransaction[] {
  return SAMPLE_DATA.map((item) => {
    const taxAmount = item.preTax * item.taxRate;
    const totalAmount = item.preTax + taxAmount;

    return {
      date: daysAgo(item.daysAgo),
      type: item.type,
      description: `${DEMO_PREFIX} ${item.desc}`,
      merchant: item.merchant,
      totalAmount: Math.round(totalAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
    };
  });
}
