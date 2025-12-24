import type { Transaction } from '@/types';
import { INSIGHT_TYPES, SPIKE_THRESHOLDS, type Insight, type InsightExplanation } from './types';

export function detectSpikes(transactions: Transaction[]): Insight[] {
  if (transactions.length < 2) return [];

  const { AVERAGE_MULTIPLIER, DUPLICATE_WINDOW_HOURS, SEVERITY_MULTIPLIER } = SPIKE_THRESHOLDS;
  const insights: Insight[] = [];

  // Detect spikes (transactions > 2x average of OTHER transactions)
  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];
    const amount = parseFloat(txn.totalAmount);

    // Calculate average excluding this transaction
    const otherAmounts = transactions
      .filter((_, idx) => idx !== i)
      .map((t) => parseFloat(t.totalAmount));

    if (otherAmounts.length === 0) continue;

    const average = otherAmounts.reduce((sum, a) => sum + a, 0) / otherAmounts.length;
    const spikeThreshold = average * AVERAGE_MULTIPLIER;

    if (amount > spikeThreshold) {
      const multiplier = amount / average;
      const severity = Math.min(10, Math.floor((multiplier - 1) * SEVERITY_MULTIPLIER));

      const explanation: InsightExplanation = {
        reason: `This transaction is significantly higher than your average spending.`,
        thresholds: [
          {
            name: 'multiplier vs average',
            actual: `${multiplier.toFixed(1)}x`,
            threshold: `${AVERAGE_MULTIPLIER}x`,
          },
          {
            name: 'transaction amount',
            actual: `$${amount.toFixed(2)}`,
            threshold: `$${spikeThreshold.toFixed(2)} (${AVERAGE_MULTIPLIER}x avg)`,
          },
        ],
        suggestion: `Review this transaction to ensure it was intentional and correctly categorized.`,
      };

      insights.push({
        type: INSIGHT_TYPES.SPIKE,
        title: `Unusual: ${txn.merchant || 'Unknown'}`,
        summary: `$${amount.toFixed(0)} (${multiplier.toFixed(1)}x your average)`,
        severityScore: severity,
        supportingTransactionIds: [txn.id],
        explanation,
      });
    }
  }

  // Detect duplicates (same merchant+amount within 24h)
  const windowMs = DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000;
  const duplicateGroups = new Map<string, Transaction[]>();

  for (const txn of transactions) {
    if (!txn.merchant) continue;
    const key = `${txn.merchant}:${txn.totalAmount}`;
    const existing = duplicateGroups.get(key) || [];
    existing.push(txn);
    duplicateGroups.set(key, existing);
  }

  for (const [, group] of duplicateGroups) {
    if (group.length < 2) continue;

    // Check if any two are within 24h of each other
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const time1 = new Date(group[i].date).getTime();
        const time2 = new Date(group[j].date).getTime();
        const diff = Math.abs(time2 - time1);

        if (diff <= windowMs) {
          const amount = parseFloat(group[i].totalAmount);
          const hoursApart = Math.round(diff / (60 * 60 * 1000));

          const explanation: InsightExplanation = {
            reason: `Two charges for the same merchant and same amount appeared within ${DUPLICATE_WINDOW_HOURS} hours.`,
            thresholds: [
              {
                name: 'time window',
                actual: `${hoursApart}h apart`,
                threshold: `${DUPLICATE_WINDOW_HOURS}h`,
              },
              {
                name: 'matching fields',
                actual: `${group[i].merchant}, $${amount.toFixed(2)}`,
                threshold: 'same merchant + amount',
              },
            ],
            suggestion: `Check if this was an accidental double charge that should be disputed.`,
          };

          insights.push({
            type: INSIGHT_TYPES.DUPLICATE,
            title: `Possible Duplicate: ${group[i].merchant}`,
            summary: `$${amount.toFixed(2)} charged twice within 24h`,
            severityScore: 5, // Fixed severity for duplicates
            supportingTransactionIds: [group[i].id, group[j].id],
            explanation,
          });
          // Only report once per pair
          break;
        }
      }
    }
  }

  return insights;
}
