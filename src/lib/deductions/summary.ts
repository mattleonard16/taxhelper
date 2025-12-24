import type { Transaction } from "@/types";
import { matchDeductionRules } from "./rules-engine";
import type {
  DeductionCategory,
  DeductionContext,
  DeductionSummary,
  DeductionSummaryResult,
} from "./types";

const DEFAULT_TAX_RATE = 0.25;

type Aggregate = {
  category: DeductionCategory;
  totalSpend: number;
  potentialDeduction: number;
  estimatedSavings: number;
  transactionIds: string[];
  merchantCounts: Map<string, number>;
  confidenceTotal: number;
  matchCount: number;
};

export function buildDeductionSummary(
  transactions: Transaction[],
  context: DeductionContext = {}
): DeductionSummaryResult {
  const aggregates = new Map<DeductionCategory, Aggregate>();
  const estimatedTaxRate = normalizeTaxRate(context.estimatedTaxRate);

  for (const transaction of transactions) {
    const matches = matchDeductionRules(transaction, context);
    if (matches.length === 0) continue;

    const bestMatch = matches[0];
    const aggregate = aggregates.get(bestMatch.category) ?? createAggregate(bestMatch.category);
    aggregate.totalSpend += bestMatch.amount;
    aggregate.potentialDeduction += bestMatch.potentialDeduction;
    aggregate.estimatedSavings += bestMatch.potentialDeduction * estimatedTaxRate;
    aggregate.transactionIds.push(transaction.id);
    aggregate.confidenceTotal += bestMatch.confidence;
    aggregate.matchCount += 1;

    if (transaction.merchant) {
      const count = aggregate.merchantCounts.get(transaction.merchant) ?? 0;
      aggregate.merchantCounts.set(transaction.merchant, count + 1);
    }

    aggregates.set(bestMatch.category, aggregate);
  }

  const deductions: DeductionSummary[] = [];
  let totalPotentialDeduction = 0;
  let totalEstimatedSavings = 0;

  for (const aggregate of aggregates.values()) {
    const totalSpend = roundCurrency(aggregate.totalSpend);
    const potentialDeduction = roundCurrency(aggregate.potentialDeduction);
    const estimatedSavings = roundCurrency(aggregate.estimatedSavings);
    const categoryLabel = formatCategoryLabel(aggregate.category);
    const transactionCount = aggregate.transactionIds.length;
    const topMerchant = pickTopMerchant(aggregate.merchantCounts);
    const summarySubject = topMerchant
      ? `${transactionCount} ${topMerchant} ${transactionCount === 1 ? "transaction" : "transactions"}`
      : `${transactionCount} transactions`;

    deductions.push({
      category: aggregate.category,
      potentialDeduction,
      estimatedSavings,
      transactions: aggregate.transactionIds,
      suggestion: `Your ${summarySubject} totaling ${formatCurrency(
        totalSpend
      )} may be deductible as ${categoryLabel}.`,
      confidence: roundConfidence(aggregate.confidenceTotal / aggregate.matchCount),
    });

    totalPotentialDeduction += potentialDeduction;
    totalEstimatedSavings += estimatedSavings;
  }

  deductions.sort((a, b) => b.potentialDeduction - a.potentialDeduction);

  return {
    deductions,
    totalPotentialDeduction: roundCurrency(totalPotentialDeduction),
    estimatedTaxSavings: roundCurrency(totalEstimatedSavings),
  };
}

export function formatCategoryLabel(category: DeductionCategory): string {
  return category
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}

function createAggregate(category: DeductionCategory): Aggregate {
  return {
    category,
    totalSpend: 0,
    potentialDeduction: 0,
    estimatedSavings: 0,
    transactionIds: [],
    merchantCounts: new Map(),
    confidenceTotal: 0,
    matchCount: 0,
  };
}

function normalizeTaxRate(taxRate?: number): number {
  if (taxRate === undefined || Number.isNaN(taxRate)) {
    return DEFAULT_TAX_RATE;
  }

  if (taxRate > 1) {
    return clamp(taxRate / 100, 0, 1);
  }

  return clamp(taxRate, 0, 1);
}

function pickTopMerchant(merchantCounts: Map<string, number>): string | null {
  let topMerchant: string | null = null;
  let topCount = 0;

  for (const [merchant, count] of merchantCounts.entries()) {
    if (count > topCount) {
      topMerchant = merchant;
      topCount = count;
    }
  }

  return topMerchant;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function roundConfidence(value: number): number {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}
