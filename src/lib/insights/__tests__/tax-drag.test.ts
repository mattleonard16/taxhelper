import { describe, it, expect } from 'vitest';
import { detectTaxDrag } from '../tax-drag';
import type { Transaction } from '@/types';

function createTransaction(
  overrides: Partial<Transaction> & { merchant: string; totalAmount: string; taxAmount: string }
): Transaction {
  return {
    id: `txn-${Math.random().toString(36).slice(2)}`,
    date: new Date().toISOString(),
    type: 'SALES_TAX',
    description: null,
    currency: 'USD',
    ...overrides,
  };
}

describe('detectTaxDrag', () => {
  it('flags merchants with effective tax rate above 9%', () => {
    // Total: $100, Tax: $10 = 10% effective rate
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Whole Foods', totalAmount: '50.00', taxAmount: '5.00' }),
      createTransaction({ merchant: 'Whole Foods', totalAmount: '50.00', taxAmount: '5.00' }),
    ];

    const insights = detectTaxDrag(transactions);

    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('TAX_DRAG');
    expect(insights[0].title).toContain('Whole Foods');
  });

  it('ignores merchants with tax rate at or below 9%', () => {
    // Total: $100, Tax: $8 = 8% effective rate
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Target', totalAmount: '50.00', taxAmount: '4.00' }),
      createTransaction({ merchant: 'Target', totalAmount: '50.00', taxAmount: '4.00' }),
    ];

    const insights = detectTaxDrag(transactions);

    expect(insights).toHaveLength(0);
  });

  it('ignores low-spend merchants under $100 total', () => {
    // Total: $50, Tax: $5 = 10% rate but under spend threshold
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Small Shop', totalAmount: '25.00', taxAmount: '2.50' }),
      createTransaction({ merchant: 'Small Shop', totalAmount: '25.00', taxAmount: '2.50' }),
    ];

    const insights = detectTaxDrag(transactions);

    expect(insights).toHaveLength(0);
  });

  it('severity increases with tax rate above baseline', () => {
    // 9.5% rate: severity = floor((0.095 - 0.08) * 100) = 1
    const lowRate: Transaction[] = [
      createTransaction({ merchant: 'Store A', totalAmount: '100.00', taxAmount: '9.50' }),
    ];

    // 12% rate: severity = floor((0.12 - 0.08) * 100) = 4
    const highRate: Transaction[] = [
      createTransaction({ merchant: 'Store B', totalAmount: '100.00', taxAmount: '12.00' }),
    ];

    const lowInsights = detectTaxDrag(lowRate);
    const highInsights = detectTaxDrag(highRate);

    expect(lowInsights[0].severityScore).toBe(1);
    expect(highInsights[0].severityScore).toBe(4);
  });

  it('caps severity at 10', () => {
    // 25% rate: would be floor((0.25 - 0.08) * 100) = 17, capped at 10
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'High Tax', totalAmount: '100.00', taxAmount: '25.00' }),
    ];

    const insights = detectTaxDrag(transactions);

    expect(insights[0].severityScore).toBe(10);
  });

  it('returns empty array for empty transactions', () => {
    const insights = detectTaxDrag([]);
    expect(insights).toEqual([]);
  });

  it('handles null merchant gracefully', () => {
    const transactions: Transaction[] = [
      { ...createTransaction({ merchant: 'X', totalAmount: '100.00', taxAmount: '15.00' }), merchant: null },
    ];

    const insights = detectTaxDrag(transactions);
    expect(insights).toHaveLength(0);
  });

  it('detects multiple merchants as separate insights', () => {
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Store A', totalAmount: '100.00', taxAmount: '12.00' }),
      createTransaction({ merchant: 'Store B', totalAmount: '100.00', taxAmount: '11.00' }),
    ];

    const insights = detectTaxDrag(transactions);

    expect(insights).toHaveLength(2);
    const merchants = insights.map((i) => i.title);
    expect(merchants.some((t) => t.includes('Store A'))).toBe(true);
    expect(merchants.some((t) => t.includes('Store B'))).toBe(true);
  });

  it('includes effective rate and total in summary', () => {
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Whole Foods', totalAmount: '200.00', taxAmount: '20.40' }),
    ];

    const insights = detectTaxDrag(transactions);

    // 20.40/200 = 10.2%
    expect(insights[0].summary).toMatch(/10\.2%/);
    expect(insights[0].summary).toMatch(/\$200/);
  });

  it('aggregates multiple transactions for same merchant', () => {
    const transactions: Transaction[] = [
      createTransaction({ merchant: 'Whole Foods', totalAmount: '100.00', taxAmount: '10.00' }),
      createTransaction({ merchant: 'Whole Foods', totalAmount: '100.00', taxAmount: '10.20' }),
      createTransaction({ merchant: 'Whole Foods', totalAmount: '100.00', taxAmount: '10.00' }),
    ];

    const insights = detectTaxDrag(transactions);

    expect(insights).toHaveLength(1);
    // Total: $300, Tax: $30.20 = 10.07%
    expect(insights[0].supportingTransactionIds).toHaveLength(3);
  });
});
