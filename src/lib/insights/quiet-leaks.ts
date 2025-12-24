import type { Transaction } from '@/types';
import { INSIGHT_TYPES, QUIET_LEAK_THRESHOLDS, type Insight, type InsightExplanation } from './types';

interface MerchantGroup {
  merchant: string;
  transactions: Transaction[];
  total: number;
  maxIndividualAmount: number;
}

export function detectQuietLeaks(transactions: Transaction[]): Insight[] {
  const { MIN_OCCURRENCES, MAX_INDIVIDUAL_AMOUNT, MIN_CUMULATIVE_TOTAL, SEVERITY_DIVISOR } =
    QUIET_LEAK_THRESHOLDS;

  // Group transactions by merchant
  const merchantMap = new Map<string, Transaction[]>();

  for (const txn of transactions) {
    if (!txn.merchant) continue;

    const amount = parseFloat(txn.totalAmount);
    if (amount > MAX_INDIVIDUAL_AMOUNT) continue;

    const existing = merchantMap.get(txn.merchant) || [];
    existing.push(txn);
    merchantMap.set(txn.merchant, existing);
  }

  // Build merchant groups with totals
  const groups: MerchantGroup[] = [];
  for (const [merchant, txns] of merchantMap) {
    if (txns.length < MIN_OCCURRENCES) continue;

    const total = txns.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0);
    if (total < MIN_CUMULATIVE_TOTAL) continue;

    const maxIndividualAmount = Math.max(...txns.map(t => parseFloat(t.totalAmount)));
    groups.push({ merchant, transactions: txns, total, maxIndividualAmount });
  }

  // Convert to insights
  return groups.map((group): Insight => {
    const severity = Math.min(10, Math.floor(group.total / SEVERITY_DIVISOR));
    const count = group.transactions.length;
    const formattedTotal = `$${group.total.toFixed(2)}`;

    const explanation: InsightExplanation = {
      reason: `You have recurring small purchases at ${group.merchant} that add up over time.`,
      thresholds: [
        {
          name: 'occurrences',
          actual: count,
          threshold: MIN_OCCURRENCES,
        },
        {
          name: 'cumulative total',
          actual: formattedTotal,
          threshold: `$${MIN_CUMULATIVE_TOTAL}`,
        },
        {
          name: 'individual amount',
          actual: `≤$${group.maxIndividualAmount.toFixed(2)}`,
          threshold: `≤$${MAX_INDIVIDUAL_AMOUNT}`,
        },
      ],
      suggestion: `Consider whether these frequent purchases at ${group.merchant} are necessary, or if you could reduce them.`,
    };

    return {
      type: INSIGHT_TYPES.QUIET_LEAK,
      title: `Quiet Leak: ${group.merchant}`,
      summary: `${count} purchases totaling ${formattedTotal}`,
      severityScore: severity,
      supportingTransactionIds: group.transactions.map((t) => t.id),
      explanation,
    };
  });
}
