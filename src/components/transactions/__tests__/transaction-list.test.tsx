import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionList } from '../transaction-list';
import { Transaction } from '@/types';

const mockTransactions: Transaction[] = [
  {
    id: '1',
    date: '2024-01-15T12:00:00.000Z',
    type: 'SALES_TAX',
    description: 'Groceries',
    merchant: 'Whole Foods',
    totalAmount: '54.32',
    taxAmount: '4.32',
  },
  {
    id: '2',
    date: '2024-01-14T12:00:00.000Z',
    type: 'INCOME_TAX',
    description: 'Paycheck',
    merchant: 'Acme Corp',
    totalAmount: '5000.00',
    taxAmount: '1250.00',
  },
  {
    id: '3',
    date: '2024-01-13T12:00:00.000Z',
    type: 'OTHER',
    description: null,
    merchant: null,
    totalAmount: '100.00',
    taxAmount: '8.00',
  },
];

describe('TransactionList', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no transactions', () => {
    render(
      <TransactionList
        transactions={[]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('No transactions found')).toBeInTheDocument();
    expect(
      screen.getByText('Try adjusting your filters or add a new transaction to start tracking.')
    ).toBeInTheDocument();
  });

  it('renders transaction list with data', () => {
    render(
      <TransactionList
        transactions={mockTransactions}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Check merchants are rendered
    expect(screen.getByText('Whole Foods')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();

    // Check descriptions are rendered
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Paycheck')).toBeInTheDocument();

    // Check type badges are rendered
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('displays formatted currency amounts', () => {
    render(
      <TransactionList
        transactions={mockTransactions}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Check total amounts
    expect(screen.getByText('$54.32')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();

    // Check tax amounts
    expect(screen.getByText('$4.32')).toBeInTheDocument();
    expect(screen.getByText('$1,250.00')).toBeInTheDocument();
  });

  it('displays em-dash for missing merchant and description', () => {
    render(
      <TransactionList
        transactions={mockTransactions}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Transaction 3 has null merchant and description
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TransactionList
        transactions={mockTransactions}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    await user.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
    expect(mockOnEdit).toHaveBeenCalledWith(mockTransactions[0]);
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TransactionList
        transactions={mockTransactions}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith('1');
  });

  it('calculates and displays tax rate correctly', () => {
    render(
      <TransactionList
        transactions={mockTransactions}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Transaction 1: tax=4.32, total=54.32, preTax=50, rate=8.6%
    expect(screen.getByText('8.6%')).toBeInTheDocument();

    // Transaction 2: tax=1250, total=5000, preTax=3750, rate=33.3%
    expect(screen.getByText('33.3%')).toBeInTheDocument();

    // Transaction 3: tax=8, total=100, preTax=92, rate=8.7%
    expect(screen.getByText('8.7%')).toBeInTheDocument();
  });
});
