import { describe, it, expect } from 'vitest';
import { detectQuietLeaks } from '../quiet-leaks';
import { detectTaxDrag } from '../tax-drag';
import { detectSpikes } from '../spikes';
import type { Transaction } from '@/types';
import { QUIET_LEAK_THRESHOLDS, TAX_DRAG_THRESHOLDS, SPIKE_THRESHOLDS } from '../types';

function createTransaction(
  overrides: Partial<Transaction> & { merchant: string; totalAmount: string }
): Transaction {
  return {
    id: `txn-${Math.random().toString(36).slice(2)}`,
    date: new Date().toISOString(),
    type: 'SALES_TAX',
    description: null,
    currency: 'USD',
    taxAmount: '0.50',
    ...overrides,
  };
}

describe('Insight Explanations', () => {
  describe('Quiet Leak explanations', () => {
    it('includes explanation with reason, thresholds, and suggestion', () => {
      const transactions: Transaction[] = [
        createTransaction({ merchant: 'Starbucks', totalAmount: '15.00' }),
        createTransaction({ merchant: 'Starbucks', totalAmount: '18.00' }),
        createTransaction({ merchant: 'Starbucks', totalAmount: '20.00' }),
      ];

      const insights = detectQuietLeaks(transactions);

      expect(insights).toHaveLength(1);
      expect(insights[0].explanation).toBeDefined();
      expect(insights[0].explanation?.reason).toContain('recurring small purchases');
      expect(insights[0].explanation?.thresholds).toHaveLength(3);
      
      const thresholdNames = insights[0].explanation?.thresholds.map(t => t.name);
      expect(thresholdNames).toContain('occurrences');
      expect(thresholdNames).toContain('cumulative total');
      expect(thresholdNames).toContain('individual amount');
      
      expect(insights[0].explanation?.suggestion).toBeDefined();
    });

    it('shows actual values vs threshold values', () => {
      const transactions: Transaction[] = [
        createTransaction({ merchant: 'Starbucks', totalAmount: '15.00' }),
        createTransaction({ merchant: 'Starbucks', totalAmount: '18.00' }),
        createTransaction({ merchant: 'Starbucks', totalAmount: '20.00' }),
      ];

      const insights = detectQuietLeaks(transactions);
      const occurrenceThreshold = insights[0].explanation?.thresholds.find(
        t => t.name === 'occurrences'
      );

      expect(occurrenceThreshold?.actual).toBe(3);
      expect(occurrenceThreshold?.threshold).toBe(QUIET_LEAK_THRESHOLDS.MIN_OCCURRENCES);
    });
  });

  describe('Tax Drag explanations', () => {
    it('includes explanation with tax rate comparison', () => {
      const transactions: Transaction[] = [
        createTransaction({ merchant: 'Fancy Store', totalAmount: '100.00', taxAmount: '12.00' }),
        createTransaction({ merchant: 'Fancy Store', totalAmount: '50.00', taxAmount: '6.00' }),
      ];

      const insights = detectTaxDrag(transactions);

      expect(insights).toHaveLength(1);
      expect(insights[0].explanation).toBeDefined();
      expect(insights[0].explanation?.reason).toContain('tax rate');
      
      const rateThreshold = insights[0].explanation?.thresholds.find(
        t => t.name === 'effective tax rate'
      );
      expect(rateThreshold).toBeDefined();
      expect(rateThreshold?.actual).toBe('12.0%');
      expect(rateThreshold?.threshold).toBe(`${TAX_DRAG_THRESHOLDS.MIN_TAX_RATE * 100}%`);
      
      expect(insights[0].explanation?.suggestion).toBeDefined();
    });

    it('shows minimum spend threshold', () => {
      const transactions: Transaction[] = [
        createTransaction({ merchant: 'Fancy Store', totalAmount: '100.00', taxAmount: '12.00' }),
        createTransaction({ merchant: 'Fancy Store', totalAmount: '50.00', taxAmount: '6.00' }),
      ];

      const insights = detectTaxDrag(transactions);
      const spentThreshold = insights[0].explanation?.thresholds.find(
        t => t.name === 'total spent'
      );

      expect(spentThreshold?.actual).toBe('$150');
      expect(spentThreshold?.threshold).toBe(`$${TAX_DRAG_THRESHOLDS.MIN_TOTAL_SPENT}`);
    });
  });

  describe('Spike explanations', () => {
    it('includes explanation for unusual amount spikes', () => {
      const transactions: Transaction[] = [
        createTransaction({ merchant: 'Normal', totalAmount: '20.00' }),
        createTransaction({ merchant: 'Normal', totalAmount: '25.00' }),
        createTransaction({ merchant: 'Big Purchase', totalAmount: '200.00' }),
      ];

      const insights = detectSpikes(transactions);
      const spikeInsight = insights.find(i => i.type === 'SPIKE');

      expect(spikeInsight).toBeDefined();
      expect(spikeInsight?.explanation).toBeDefined();
      expect(spikeInsight?.explanation?.reason).toContain('average');
      
      const multiplierThreshold = spikeInsight?.explanation?.thresholds.find(
        t => t.name === 'multiplier vs average'
      );
      expect(multiplierThreshold).toBeDefined();
      expect(multiplierThreshold?.threshold).toBe(`${SPIKE_THRESHOLDS.AVERAGE_MULTIPLIER}x`);
      
      expect(spikeInsight?.explanation?.suggestion).toBeDefined();
    });

    it('includes explanation for duplicate detection', () => {
      const baseDate = new Date();
      const transactions: Transaction[] = [
        createTransaction({
          merchant: 'Store',
          totalAmount: '50.00',
          date: baseDate.toISOString(),
        }),
        createTransaction({
          merchant: 'Store',
          totalAmount: '50.00',
          date: new Date(baseDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour later
        }),
      ];

      const insights = detectSpikes(transactions);
      const duplicateInsight = insights.find(i => i.type === 'DUPLICATE');

      expect(duplicateInsight).toBeDefined();
      expect(duplicateInsight?.explanation).toBeDefined();
      expect(duplicateInsight?.explanation?.reason).toContain('same merchant');
      expect(duplicateInsight?.explanation?.reason).toContain('same amount');
      
      const windowThreshold = duplicateInsight?.explanation?.thresholds.find(
        t => t.name === 'time window'
      );
      expect(windowThreshold).toBeDefined();
      expect(windowThreshold?.threshold).toBe(`${SPIKE_THRESHOLDS.DUPLICATE_WINDOW_HOURS}h`);
      
      expect(duplicateInsight?.explanation?.suggestion).toBeDefined();
    });
  });
});
