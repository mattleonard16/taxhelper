import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectSpikes } from '../spikes';
import type { Transaction } from '@/types';

function createTransaction(
  overrides: Partial<Transaction> & { totalAmount: string; date?: string }
): Transaction {
  return {
    id: `txn-${Math.random().toString(36).slice(2)}`,
    date: overrides.date || new Date().toISOString(),
    type: 'SALES_TAX',
    description: null,
    merchant: 'Store',
    currency: 'USD',
    taxAmount: '1.00',
    ...overrides,
  };
}

describe('detectSpikes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects transactions more than 2x average', () => {
    // Average of first 4: (10+10+10+10)/4 = 10
    // Fifth transaction: 25 (2.5x average)
    const transactions: Transaction[] = [
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '25.00', merchant: 'Best Buy' }),
    ];

    const insights = detectSpikes(transactions);

    expect(insights.some((i) => i.type === 'SPIKE')).toBe(true);
    const spikeInsight = insights.find((i) => i.type === 'SPIKE');
    expect(spikeInsight?.title).toContain('Best Buy');
  });

  it('returns empty for uniform transactions', () => {
    const transactions: Transaction[] = [
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
    ];

    const insights = detectSpikes(transactions);

    expect(insights.filter((i) => i.type === 'SPIKE')).toHaveLength(0);
  });

  it('detects duplicate-like entries within 24h', () => {
    const baseDate = new Date('2024-06-15T10:00:00Z');
    const withinWindow = new Date('2024-06-15T20:00:00Z'); // 10 hours later

    const transactions: Transaction[] = [
      createTransaction({
        merchant: 'Amazon',
        totalAmount: '99.99',
        date: baseDate.toISOString(),
      }),
      createTransaction({
        merchant: 'Amazon',
        totalAmount: '99.99',
        date: withinWindow.toISOString(),
      }),
    ];

    const insights = detectSpikes(transactions);

    expect(insights.some((i) => i.type === 'DUPLICATE')).toBe(true);
    const dupInsight = insights.find((i) => i.type === 'DUPLICATE');
    expect(dupInsight?.title).toContain('Amazon');
  });

  it('ignores same merchant+amount outside 24h window', () => {
    const baseDate = new Date('2024-06-13T10:00:00Z');
    const outsideWindow = new Date('2024-06-15T12:00:00Z'); // 50 hours later

    const transactions: Transaction[] = [
      createTransaction({
        merchant: 'Amazon',
        totalAmount: '99.99',
        date: baseDate.toISOString(),
      }),
      createTransaction({
        merchant: 'Amazon',
        totalAmount: '99.99',
        date: outsideWindow.toISOString(),
      }),
    ];

    const insights = detectSpikes(transactions);

    expect(insights.filter((i) => i.type === 'DUPLICATE')).toHaveLength(0);
  });

  it('severity scales with spike magnitude', () => {
    // Average: 10, Spike at 3x = severity floor((3-1)*2) = 4
    const lowSpike: Transaction[] = [
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '30.00', merchant: 'Store A' }),
    ];

    // Average: 10, Spike at 5x = severity floor((5-1)*2) = 8
    const highSpike: Transaction[] = [
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '50.00', merchant: 'Store B' }),
    ];

    const lowInsights = detectSpikes(lowSpike);
    const highInsights = detectSpikes(highSpike);

    const lowSeverity = lowInsights.find((i) => i.type === 'SPIKE')?.severityScore;
    const highSeverity = highInsights.find((i) => i.type === 'SPIKE')?.severityScore;

    expect(lowSeverity).toBe(4);
    expect(highSeverity).toBe(8);
  });

  it('caps severity at 10', () => {
    // Average: 10, Spike at 10x = would be floor((10-1)*2) = 18, capped at 10
    const transactions: Transaction[] = [
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '100.00', merchant: 'Expensive' }),
    ];

    const insights = detectSpikes(transactions);
    const spikeInsight = insights.find((i) => i.type === 'SPIKE');

    expect(spikeInsight?.severityScore).toBe(10);
  });

  it('returns empty array for empty transactions', () => {
    const insights = detectSpikes([]);
    expect(insights).toEqual([]);
  });

  it('returns empty array for single transaction', () => {
    const transactions: Transaction[] = [createTransaction({ totalAmount: '100.00' })];

    const insights = detectSpikes(transactions);

    expect(insights).toEqual([]);
  });

  it('includes multiplier in spike summary', () => {
    const transactions: Transaction[] = [
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '32.00', merchant: 'Big Purchase' }),
    ];

    const insights = detectSpikes(transactions);
    const spikeInsight = insights.find((i) => i.type === 'SPIKE');

    // 32/10 = 3.2x
    expect(spikeInsight?.summary).toMatch(/3\.2x/);
  });

  it('detects multiple spikes', () => {
    const transactions: Transaction[] = [
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '10.00' }),
      createTransaction({ totalAmount: '50.00', merchant: 'Store A' }),
      createTransaction({ totalAmount: '60.00', merchant: 'Store B' }),
    ];

    const insights = detectSpikes(transactions);
    const spikeInsights = insights.filter((i) => i.type === 'SPIKE');

    expect(spikeInsights.length).toBeGreaterThanOrEqual(2);
  });
});
