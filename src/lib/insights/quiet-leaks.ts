import type { Transaction } from '@/types';
import { INSIGHT_TYPES, QUIET_LEAK_THRESHOLDS, type Insight } from './types';

interface MerchantGroup {
  merchant: string;
  transactions: Transaction[];
  total: number;
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

    groups.push({ merchant, transactions: txns, total });
  }

  // Convert to insights
  return groups.map((group): Insight => {
    const severity = Math.min(10, Math.floor(group.total / SEVERITY_DIVISOR));
    const count = group.transactions.length;
    const formattedTotal = `$${group.total.toFixed(2)}`;

    return {
      type: INSIGHT_TYPES.QUIET_LEAK,
      title: `Quiet Leak: ${group.merchant}`,
      summary: `${count} purchases totaling ${formattedTotal}`,
      severityScore: severity,
      supportingTransactionIds: group.transactions.map((t) => t.id),
    };
  });
}
