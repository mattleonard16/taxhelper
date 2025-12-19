import type { Transaction } from '@/types';
import { INSIGHT_TYPES, TAX_DRAG_THRESHOLDS, type Insight } from './types';

interface MerchantTaxData {
  merchant: string;
  transactions: Transaction[];
  totalSpent: number;
  totalTax: number;
  effectiveRate: number;
}

export function detectTaxDrag(transactions: Transaction[]): Insight[] {
  const { MIN_TAX_RATE, MIN_TOTAL_SPENT, BASELINE_RATE, SEVERITY_MULTIPLIER } = TAX_DRAG_THRESHOLDS;

  // Group transactions by merchant
  const merchantMap = new Map<string, Transaction[]>();

  for (const txn of transactions) {
    if (!txn.merchant) continue;

    const existing = merchantMap.get(txn.merchant) || [];
    existing.push(txn);
    merchantMap.set(txn.merchant, existing);
  }

  // Calculate tax data per merchant
  const merchantData: MerchantTaxData[] = [];

  for (const [merchant, txns] of merchantMap) {
    const totalSpent = txns.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0);
    const totalTax = txns.reduce((sum, t) => sum + parseFloat(t.taxAmount), 0);

    if (totalSpent < MIN_TOTAL_SPENT) continue;

    const effectiveRate = totalTax / totalSpent;
    if (effectiveRate <= MIN_TAX_RATE) continue;

    merchantData.push({ merchant, transactions: txns, totalSpent, totalTax, effectiveRate });
  }

  // Convert to insights
  return merchantData.map((data): Insight => {
    // Handle floating point precision (e.g., 0.12 - 0.08 = 0.03999...)
    // Round intermediate diff to 4 decimal places, then floor
    const diff = Math.round((data.effectiveRate - BASELINE_RATE) * 10000) / 10000;
    const severity = Math.min(10, Math.floor(diff * SEVERITY_MULTIPLIER));
    const ratePercent = (data.effectiveRate * 100).toFixed(1);
    const formattedTotal = `$${data.totalSpent.toFixed(0)}`;

    return {
      type: INSIGHT_TYPES.TAX_DRAG,
      title: `High Tax: ${data.merchant}`,
      summary: `${ratePercent}% effective rate on ${formattedTotal}`,
      severityScore: severity,
      supportingTransactionIds: data.transactions.map((t) => t.id),
    };
  });
}
