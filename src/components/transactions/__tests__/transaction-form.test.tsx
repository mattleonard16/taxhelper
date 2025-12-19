import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from '../transaction-form';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TransactionForm', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Default: return empty templates
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ templates: [] }),
    });
  });

  it('renders the form in add mode', () => {
    render(
      <TransactionForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Add Transaction')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText(/Merchant/)).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText(/Total Amount/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tax Amount/)).toBeInTheDocument();
  });

  it('renders the form in edit mode with transaction data', () => {
    const transaction = {
      id: '123',
      date: '2024-01-15T12:00:00.000Z',
      type: 'SALES_TAX',
      description: 'Test description',
      merchant: 'Test Merchant',
      totalAmount: '100.00',
      taxAmount: '8.00',
    };

    render(
      <TransactionForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
        transaction={transaction}
      />
    );

    expect(screen.getByText('Edit Transaction')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Merchant')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100.00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8.00')).toBeInTheDocument();
  });

  it('shows correct labels based on transaction type in edit mode', () => {
    const incomeTransaction = {
      id: '123',
      date: '2024-01-15T12:00:00.000Z',
      type: 'INCOME_TAX',
      description: 'Paycheck',
      merchant: 'Acme Corp',
      totalAmount: '5000.00',
      taxAmount: '1250.00',
    };

    render(
      <TransactionForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
        transaction={incomeTransaction}
      />
    );

    // Check that labels are for income tax
    expect(screen.getByText('Employer')).toBeInTheDocument();
    expect(screen.getByText('Gross Pay')).toBeInTheDocument();
    expect(screen.getByText('Tax Withheld')).toBeInTheDocument();
  });

  it('calculates tax amount when using tax rate', async () => {
    const user = userEvent.setup();

    render(
      <TransactionForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Enter total amount
    const totalInput = screen.getByLabelText(/Total Amount/);
    await user.clear(totalInput);
    await user.type(totalInput, '100');

    // Click "Use tax rate" button
    const useRateButton = screen.getByRole('button', { name: /use tax rate/i });
    await user.click(useRateButton);

    // Enter tax rate
    const rateInput = screen.getByPlaceholderText('8.875');
    await user.type(rateInput, '10');

    // Check that tax amount was calculated
    await waitFor(() => {
      const taxInput = screen.getByLabelText(/Tax Amount/) as HTMLInputElement;
      expect(taxInput.value).toBe('9.09');
    });
  });

  it('calls onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TransactionForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('submits form data for new transaction', async () => {
    const user = userEvent.setup();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ templates: [] }),
    }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ defaultTaxRate: null }),
    }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: '123' }),
    });

    render(
      <TransactionForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill in the form
    const merchantInput = screen.getByLabelText(/Merchant/);
    await user.type(merchantInput, 'Test Store');

    const totalInput = screen.getByLabelText(/Total Amount/);
    await user.type(totalInput, '50');

    const taxInput = screen.getByLabelText(/Tax Amount/);
    await user.type(taxInput, '4.50');

    // Submit
    const addButton = screen.getByRole('button', { name: /^add$/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/transactions', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('displays error message on submission failure', async () => {
    const user = userEvent.setup();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ templates: [] }),
    }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ defaultTaxRate: null }),
    }).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Validation failed' }),
    });

    render(
      <TransactionForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill in required fields
    const totalInput = screen.getByLabelText(/Total Amount/);
    await user.type(totalInput, '50');

    const taxInput = screen.getByLabelText(/Tax Amount/);
    await user.type(taxInput, '4.50');

    // Submit
    const addButton = screen.getByRole('button', { name: /^add$/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Validation failed');
    });
  });

  it('fetches and displays templates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        templates: [
          { id: 't1', label: 'Groceries Template', merchant: 'Whole Foods', taxRate: '0.08625', type: 'SALES_TAX', isDefault: true },
          { id: 't2', label: 'Gas Template', merchant: 'Shell', taxRate: '0.05', type: 'SALES_TAX', isDefault: false },
        ],
      }),
    });

    render(
      <TransactionForm
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Use Template (optional)')).toBeInTheDocument();
    });
  });
});
