import type { Transaction } from "@/types";
import type { Insight } from "./types";
import { INSIGHT_TYPES } from "./types";
import {
  buildDeductionSummary,
  formatCategoryLabel,
  formatCurrency,
  type DeductionContext,
} from "@/lib/deductions";

export function detectDeductionInsights(
  transactions: Transaction[],
  context: DeductionContext = {}
): Insight[] {
  const summary = buildDeductionSummary(transactions, context);

  return summary.deductions.map((deduction) => {
    const categoryLabel = formatCategoryLabel(deduction.category);
    const severityScore = calculateSeverityScore(deduction.estimatedSavings);

    return {
      type: INSIGHT_TYPES.DEDUCTION,
      title: `Potential ${categoryLabel} deduction: ${formatCurrency(
        deduction.potentialDeduction
      )}`,
      summary: `${deduction.suggestion} Estimated tax savings: ${formatCurrency(
        deduction.estimatedSavings
      )}.`,
      severityScore,
      supportingTransactionIds: deduction.transactions,
    };
  });
}

function calculateSeverityScore(estimatedSavings: number): number {
  const score = Math.ceil(estimatedSavings / 100);
  return Math.min(10, Math.max(1, score));
}
