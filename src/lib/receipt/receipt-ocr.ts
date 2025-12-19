/**
 * OCR parsing utilities for receipt text extraction
 * Extracts vendor, total, tax, date, and description from receipt text
 */

export interface OCRResult {
    vendor: string | null;
    totalAmount: number | null;
    taxAmount: number | null;
    date: string | null;
    description: string | null;
}

/**
 * Parses OCR text from a receipt to extract structured data
 */
export function parseReceiptOCR(text: string): OCRResult {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const result: OCRResult = {
        vendor: null,
        totalAmount: null,
        taxAmount: null,
        date: null,
        description: null,
    };

    // Extract vendor from first meaningful line
    result.vendor = extractVendor(lines);

    // Extract total amount
    result.totalAmount = extractTotal(text);

    // Extract tax amount
    result.taxAmount = extractTax(text);

    // Extract date
    result.date = extractDate(text);

    // Extract description from item lines
    result.description = extractDescription(lines);

    return result;
}

/**
 * Extracts vendor name from receipt lines
 * Usually the first 1-2 lines that aren't addresses, phone numbers, or prices
 * Requires the text to look like a receipt (have amount/total patterns)
 */
function extractVendor(lines: string[]): string | null {
    // First check if this looks like a receipt (has price patterns)
    const text = lines.join('\n');
    const hasReceiptPattern = /\$[\d,]+\.?\d*|total|subtotal|tax/i.test(text);

    if (!hasReceiptPattern) {
        return null;
    }

    for (const line of lines.slice(0, 5)) {
        if (
            line.length > 3 &&
            !line.match(/^\d{3,}/) && // Not a phone number
            !line.match(/[#]/i) && // Not a store number
            !line.match(/\d{5}/) && // Not a zip code
            !line.match(/^\$/) && // Not a price
            !line.match(/^(store|address|phone|tel|fax)/i) // Not a label
        ) {
            return line;
        }
    }
    return null;
}

/**
 * Extracts total amount from receipt text
 */
function extractTotal(text: string): number | null {
    const patterns = [
        /(?:total|amount|balance|grand total)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
        /(?:total)\s+\$?\s*([\d,]+\.\d{2})/i,
        /\$\s*([\d,]+\.\d{2})\s*$/m,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(value)) return value;
        }
    }
    return null;
}

/**
 * Extracts tax amount from receipt text
 */
function extractTax(text: string): number | null {
    const patterns = [
        /(?:tax|sales tax|vat|gst)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
        /(?:tax)\s+\$?\s*([\d,]+\.\d{2})/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(value)) return value;
        }
    }
    return null;
}

/**
 * Extracts date from receipt text
 */
function extractDate(text: string): string | null {
    const patterns = [
        // MM/DD/YYYY or MM-DD-YYYY
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
        // Month DD, YYYY
        /([A-Za-z]{3,}\s+\d{1,2},?\s+\d{2,4})/,
        // YYYY-MM-DD
        /(\d{4}-\d{2}-\d{2})/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            try {
                const parsed = new Date(match[1]);
                if (!isNaN(parsed.getTime())) {
                    return parsed.toISOString().split('T')[0];
                }
            } catch {
                continue;
            }
        }
    }
    return null;
}

/**
 * Extracts a description from item lines
 * Looks for common item patterns and summarizes
 */
function extractDescription(lines: string[]): string | null {
    const itemPatterns = [
        /^([A-Z][A-Z\s-]+)\s+\$?[\d,]+\.?\d*/i, // ITEM NAME $price
        /^([A-Z][A-Z\s-]+)\s+-?\s*\$?[\d,]+\.?\d*/i, // ITEM NAME - $price
    ];

    const items: string[] = [];

    for (const line of lines) {
        for (const pattern of itemPatterns) {
            const match = line.match(pattern);
            if (match && match[1].length > 2) {
                const item = match[1].trim();
                // Skip common non-item lines
                if (!item.match(/^(subtotal|tax|total|change|cash|credit|debit|balance)/i)) {
                    items.push(item);
                }
            }
        }
    }

    if (items.length === 0) return null;

    // Return first few items as description
    const uniqueItems = [...new Set(items)];
    return uniqueItems.slice(0, 3).join(', ');
}
