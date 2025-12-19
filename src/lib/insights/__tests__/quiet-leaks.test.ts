import { describe, it, expect } from 'vitest';
import { detectQuietLeaks } from '../quiet-leaks';
import type { Transaction } from '@/types';

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

describe('detectQuietLeaks', () => {
  it('detects merchant with 3+ small purchases totaling $50+', () => {
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Starbucks', totalAmount: '15.00' }),
      createTransaction({ merchant: 'Starbucks', totalAmount: '18.00' }),
      createTransaction({ merchant: 'Starbucks', totalAmount: '20.00' }),
    ];

    const insights = detectQuietLeaks(transactions);

    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('QUIET_LEAK');
    expect(insights[0].title).toContain('Starbucks');
    expect(insights[0].supportingTransactionIds).toHaveLength(3);
  });

  it('ignores merchants with fewer than 3 purchases', () => {
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Starbucks', totalAmount: '15.00' }),
      createTransaction({ merchant: 'Starbucks', totalAmount: '40.00' }),
    ];

    const insights = detectQuietLeaks(transactions);

    expect(insights).toHaveLength(0);
  });

  it('ignores large individual purchases over $20', () => {
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Restaurant', totalAmount: '25.00' }),
      createTransaction({ merchant: 'Restaurant', totalAmount: '30.00' }),
      createTransaction({ merchant: 'Restaurant', totalAmount: '28.00' }),
    ];

    const insights = detectQuietLeaks(transactions);

    expect(insights).toHaveLength(0);
  });

  it('ignores merchants with cumulative total under $50', () => {
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Coffee Shop', totalAmount: '5.00' }),
      createTransaction({ merchant: 'Coffee Shop', totalAmount: '5.00' }),
      createTransaction({ merchant: 'Coffee Shop', totalAmount: '5.00' }),
    ];

    const insights = detectQuietLeaks(transactions);

    expect(insights).toHaveLength(0);
  });

  it('severity scales with total amount', () => {
    // Total: $60 -> severity floor(60/25) = 2
    const lowSpend: Transaction[] = [
      createTransaction({ merchant: 'CafeA', totalAmount: '20.00' }),
      createTransaction({ merchant: 'CafeA', totalAmount: '20.00' }),
      createTransaction({ merchant: 'CafeA', totalAmount: '20.00' }),
    ];

    // Total: $150 -> severity floor(150/25) = 6
    const highSpend: Transaction[] = [
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
      createTransaction({ merchant: 'CafeB', totalAmount: '15.00' }),
    ];

    const lowInsights = detectQuietLeaks(lowSpend);
    const highInsights = detectQuietLeaks(highSpend);

    expect(lowInsights[0].severityScore).toBe(2);
    expect(highInsights[0].severityScore).toBe(6);
  });

  it('caps severity at 10', () => {
    // Total: $300 -> would be floor(300/25) = 12, but capped at 10
    const transactions: Transaction[] = Array(20)
      .fill(null)
      .map(() => createTransaction({ merchant: 'Daily Coffee', totalAmount: '15.00' }));

    const insights = detectQuietLeaks(transactions);

    expect(insights[0].severityScore).toBe(10);
  });

  it('returns empty array for empty transactions', () => {
    const insights = detectQuietLeaks([]);
    expect(insights).toEqual([]);
  });

  it('handles null merchant gracefully', () => {
    const transactions: Transaction[] = [
      { ...createTransaction({ merchant: 'X', totalAmount: '10.00' }), merchant: null },
      { ...createTransaction({ merchant: 'X', totalAmount: '10.00' }), merchant: null },
      { ...createTransaction({ merchant: 'X', totalAmount: '10.00' }), merchant: null },
    ];

    const insights = detectQuietLeaks(transactions);
    expect(insights).toHaveLength(0);
  });

  it('detects multiple merchants as separate insights', () => {
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Starbucks', totalAmount: '18.00' }),
      createTransaction({ merchant: 'Starbucks', totalAmount: '18.00' }),
      createTransaction({ merchant: 'Starbucks', totalAmount: '18.00' }),
      createTransaction({ merchant: 'Dunkin', totalAmount: '17.00' }),
      createTransaction({ merchant: 'Dunkin', totalAmount: '17.00' }),
      createTransaction({ merchant: 'Dunkin', totalAmount: '17.00' }),
    ];

    const insights = detectQuietLeaks(transactions);

    expect(insights).toHaveLength(2);
    const merchants = insights.map((i) => i.title);
    expect(merchants.some((t) => t.includes('Starbucks'))).toBe(true);
    expect(merchants.some((t) => t.includes('Dunkin'))).toBe(true);
  });

  it('includes purchase count and total in summary', () => {
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Starbucks', totalAmount: '15.00' }),
      createTransaction({ merchant: 'Starbucks', totalAmount: '18.50' }),
      createTransaction({ merchant: 'Starbucks', totalAmount: '19.90' }),
    ];

    const insights = detectQuietLeaks(transactions);

    expect(insights[0].summary).toMatch(/3.*purchases/i);
    expect(insights[0].summary).toMatch(/\$53\.40/);
  });
});
