/**
 * CSV generation utilities for tax season export
 * Generates CSV in invoice-organizer format
 */

interface Transaction {
    id: string;
    date: Date | string;
    merchant: string | null;
    description: string | null;
    totalAmount: string | number;
    taxAmount: string | number;
    type: string;
    receiptPath?: string | null;
}

interface CSVOptions {
    includeSummary?: boolean;
}

const CSV_HEADERS = ['Date', 'Vendor', 'Description', 'Amount', 'Category', 'Tax Amount'];

/**
 * Escapes a value for CSV format
 * Handles commas, quotes, and newlines
 */
function escapeCSVValue(value: string | null | undefined): string {
    if (value === null || value === undefined) return '';

    const str = String(value);

    // Check if we need to quote the field
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        // Escape quotes by doubling them
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
    }

    return str;
}

/**
 * Formats a date as YYYY-MM-DD
 */
function formatDate(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
}

/**
 * Parses a single transaction into a CSV row
 */
export function parseCSVRow(transaction: Transaction): string {
    const values = [
        formatDate(transaction.date),
        escapeCSVValue(transaction.merchant),
        escapeCSVValue(transaction.description),
        String(transaction.totalAmount),
        transaction.type,
        String(transaction.taxAmount),
    ];

    return values.join(',');
}

/**
 * Generates a CSV string from transactions
 */
export function generateTaxSeasonCSV(
    transactions: Transaction[],
    options: CSVOptions = {}
): string {
    const { includeSummary = false } = options;

    const lines: string[] = [];

    // Header row
    lines.push(CSV_HEADERS.join(','));

    // Data rows
    for (const transaction of transactions) {
        lines.push(parseCSVRow(transaction));
    }

    // Summary section
    if (includeSummary && transactions.length > 0) {
        lines.push(''); // Empty line before summary

        // Calculate totals by type
        const totals: Record<string, { amount: number; tax: number }> = {};

        for (const t of transactions) {
            if (!totals[t.type]) {
                totals[t.type] = { amount: 0, tax: 0 };
            }
            totals[t.type].amount += parseFloat(String(t.totalAmount));
            totals[t.type].tax += parseFloat(String(t.taxAmount));
        }

        // Add summary rows
        let grandTotalAmount = 0;
        let grandTotalTax = 0;

        for (const [type, { amount, tax }] of Object.entries(totals)) {
            grandTotalAmount += amount;
            grandTotalTax += tax;
            lines.push(`TOTAL ${type.replace('_', ' ')},,,${amount.toFixed(2)},,${tax.toFixed(2)}`);
        }

        lines.push(''); // Empty line before grand total
        lines.push(`GRAND TOTAL,,,${grandTotalAmount.toFixed(2)},,${grandTotalTax.toFixed(2)}`);
    }

    return lines.join('\n');
}
