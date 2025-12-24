import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightCard } from '../insight-card';
import type { Insight, InsightExplanation } from '@/lib/insights';
import type { Transaction } from '@/types';

const defaultExplanation: InsightExplanation = {
  reason: 'You have recurring small purchases at Coffee that add up over time.',
  thresholds: [
    { name: 'occurrences', actual: 3, threshold: 3 },
    { name: 'cumulative total', actual: '$53.40', threshold: '$50' },
    { name: 'individual amount', actual: '≤$20.00', threshold: '≤$20' },
  ],
  suggestion: 'Consider whether these frequent purchases at Coffee are necessary.',
};

function createInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    type: 'QUIET_LEAK',
    title: 'Quiet Leak: Coffee',
    summary: '3 purchases totaling $53.40',
    severityScore: 2,
    supportingTransactionIds: ['tx_1', 'tx_2'],
    explanation: defaultExplanation,
    ...overrides,
  };
}

function createTransaction(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    id: overrides.id,
    date: overrides.date ?? '2024-01-15T12:00:00.000Z',
    type: overrides.type ?? 'SALES_TAX',
    description: overrides.description ?? null,
    merchant: overrides.merchant ?? 'Coffee',
    totalAmount: overrides.totalAmount ?? '10.00',
    taxAmount: overrides.taxAmount ?? '0.00',
    currency: overrides.currency ?? 'USD',
  };
}

describe('InsightCard', () => {
  const onEditTransaction = vi.fn();
  const onDeleteTransaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches missing supporting transactions when expanded', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        transactions: [createTransaction({ id: 'tx_2', merchant: 'Target' })],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InsightCard
        insight={createInsight()}
        transactions={[createTransaction({ id: 'tx_1' })]}
        onEditTransaction={onEditTransaction}
        onDeleteTransaction={onDeleteTransaction}
      />
    );

    await user.click(screen.getByRole('button', { name: /show transactions for/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/transactions?ids=tx_2');
    expect(await screen.findByText('Target')).toBeInTheDocument();
  });

  it('does not fetch when all supporting transactions are already loaded', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InsightCard
        insight={createInsight({ supportingTransactionIds: ['tx_1'] })}
        transactions={[createTransaction({ id: 'tx_1' })]}
        onEditTransaction={onEditTransaction}
        onDeleteTransaction={onDeleteTransaction}
      />
    );

    await user.click(screen.getByRole('button', { name: /show transactions for/i }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('Why am I seeing this? explainability', () => {
    it('shows "Why am I seeing this?" button when insight has explanation', () => {
      render(
        <InsightCard
          insight={createInsight()}
          transactions={[]}
          onEditTransaction={onEditTransaction}
          onDeleteTransaction={onDeleteTransaction}
        />
      );

      expect(screen.getByRole('button', { name: /why am i seeing this/i })).toBeInTheDocument();
    });

    it('does not show "Why am I seeing this?" button when insight has no explanation', () => {
      render(
        <InsightCard
          insight={createInsight({ explanation: undefined })}
          transactions={[]}
          onEditTransaction={onEditTransaction}
          onDeleteTransaction={onDeleteTransaction}
        />
      );

      expect(screen.queryByRole('button', { name: /why am i seeing this/i })).not.toBeInTheDocument();
    });

    it('shows explanation reason when button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <InsightCard
          insight={createInsight()}
          transactions={[]}
          onEditTransaction={onEditTransaction}
          onDeleteTransaction={onDeleteTransaction}
        />
      );

      await user.click(screen.getByRole('button', { name: /why am i seeing this/i }));

      expect(screen.getByText(/recurring small purchases/i)).toBeInTheDocument();
    });

    it('shows threshold details when expanded', async () => {
      const user = userEvent.setup();

      render(
        <InsightCard
          insight={createInsight()}
          transactions={[]}
          onEditTransaction={onEditTransaction}
          onDeleteTransaction={onDeleteTransaction}
        />
      );

      await user.click(screen.getByRole('button', { name: /why am i seeing this/i }));

      expect(screen.getByText(/occurrences/i)).toBeInTheDocument();
      expect(screen.getByText(/cumulative total/i)).toBeInTheDocument();
    });

    it('shows suggestion when available', async () => {
      const user = userEvent.setup();

      render(
        <InsightCard
          insight={createInsight()}
          transactions={[]}
          onEditTransaction={onEditTransaction}
          onDeleteTransaction={onDeleteTransaction}
        />
      );

      await user.click(screen.getByRole('button', { name: /why am i seeing this/i }));

      expect(screen.getByText(/consider whether these frequent purchases/i)).toBeInTheDocument();
    });

    it('can collapse explanation after expanding', async () => {
      const user = userEvent.setup();

      render(
        <InsightCard
          insight={createInsight()}
          transactions={[]}
          onEditTransaction={onEditTransaction}
          onDeleteTransaction={onDeleteTransaction}
        />
      );

      await user.click(screen.getByRole('button', { name: /why am i seeing this/i }));
      expect(screen.getByText(/recurring small purchases/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /hide explanation/i }));
      expect(screen.queryByText(/recurring small purchases/i)).not.toBeInTheDocument();
    });
  });
});
