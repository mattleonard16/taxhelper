/**
 * OCR parsing utilities for receipt text extraction.
 * Extracts merchant, subtotal, tax, total, date, and items from receipt text.
 */

export interface ReceiptItem {
    description: string;
    quantity?: number | null;
    unitPrice?: number | null;
    total?: number | null;
}

export interface ReceiptExtraction {
    merchant: string | null;
    date: string | null;
    subtotal: number | null;
    tax: number | null;
    total: number | null;
    items: ReceiptItem[];
    confidence: number;
    // LLM-powered categorization fields
    category?: string;
    categoryCode?: string;
    isDeductible?: boolean;
}

export interface ReceiptParseOptions {
    ocrConfidence?: number | null;
}

/**
 * Parses OCR text from a receipt to extract structured data.
 */
export function parseReceiptOCR(text: string, options: ReceiptParseOptions = {}): ReceiptExtraction {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

    let subtotal = extractSubtotal(text);
    const tax = extractTax(text);
    let total = extractTotal(text);
    const items = extractItems(lines);

    if (subtotal === null && total !== null && tax !== null) {
        subtotal = roundCurrency(total - tax);
    }

    if (total === null && subtotal !== null && tax !== null) {
        total = roundCurrency(subtotal + tax);
    }

    const extraction = {
        merchant: extractMerchant(lines),
        subtotal,
        tax,
        total,
        date: extractDate(text),
        items,
    };

    return {
        ...extraction,
        confidence: calculateReceiptConfidence(extraction, options.ocrConfidence),
    };
}

export function createEmptyReceiptExtraction(): ReceiptExtraction {
    return {
        merchant: null,
        date: null,
        subtotal: null,
        tax: null,
        total: null,
        items: [],
        confidence: 0,
    };
}

export function summarizeReceiptItems(items: ReceiptItem[], maxItems = 3): string | null {
    const names = items.map((item) => item.description).filter(Boolean);
    if (names.length === 0) return null;

    const unique = [...new Set(names)];
    return unique.slice(0, maxItems).join(', ');
}

export function calculateReceiptConfidence(
    extraction: Omit<ReceiptExtraction, 'confidence'>,
    ocrConfidence?: number | null
): number {
    const weights = {
        merchant: 0.2,
        date: 0.15,
        total: 0.3,
        tax: 0.1,
        subtotal: 0.1,
        items: 0.15,
    };

    let dataScore = 0;
    if (extraction.merchant) dataScore += weights.merchant;
    if (extraction.date) dataScore += weights.date;
    if (extraction.total !== null) dataScore += weights.total;
    if (extraction.tax !== null) dataScore += weights.tax;
    if (extraction.subtotal !== null) dataScore += weights.subtotal;
    if (extraction.items.length > 0) dataScore += weights.items;

    const normalizedOcr = normalizeOcrConfidence(ocrConfidence);
    if (normalizedOcr === null) {
        return clamp(dataScore, 0, 1);
    }

    const combined = dataScore * 0.8 + normalizedOcr * 0.2;
    return clamp(combined, 0, 1);
}

/**
 * Extracts merchant name from receipt lines.
 * Usually the first 1-2 lines that are not addresses, phone numbers, or prices.
 * Requires the text to look like a receipt (has amount/total patterns).
 */
function extractMerchant(lines: string[]): string | null {
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
 * Extracts total amount from receipt text.
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
            const value = parseCurrency(match[1]);
            if (value !== null) return value;
        }
    }
    return null;
}

/**
 * Extracts subtotal amount from receipt text.
 */
function extractSubtotal(text: string): number | null {
    const patterns = [
        /(?:subtotal|sub total)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
        /(?:subtotal)\s+\$?\s*([\d,]+\.\d{2})/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = parseCurrency(match[1]);
            if (value !== null) return value;
        }
    }
    return null;
}

/**
 * Extracts tax amount from receipt text.
 */
function extractTax(text: string): number | null {
    const patterns = [
        /(?:tax|sales tax|vat|gst)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
        /(?:tax)\s+\$?\s*([\d,]+\.\d{2})/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = parseCurrency(match[1]);
            if (value !== null) return value;
        }
    }
    return null;
}

/**
 * Extracts date from receipt text.
 */
function extractDate(text: string): string | null {
    const patterns = [
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
        /([A-Za-z]{3,}\s+\d{1,2},?\s+\d{2,4})/,
        /(\d{4}-\d{2}-\d{2})/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const parsed = normalizeDate(match[1]);
            if (parsed) return parsed;
        }
    }
    return null;
}

/**
 * Extracts item lines from receipt text.
 */
function extractItems(lines: string[]): ReceiptItem[] {
    const ignorePattern = /^(subtotal|tax|total|change|cash|credit|debit|balance|amount|tip|vat|gst|rounding|discount)/i;
    const items: ReceiptItem[] = [];
    const seen = new Set<string>();

    const quantityPattern = /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:x|@)\s*\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})$/i;
    const pricePattern = /^(.+?)\s+\$?([\d,]+\.\d{2})$/;

    for (const line of lines) {
        if (!line || ignorePattern.test(line)) {
            continue;
        }

        const quantityMatch = line.match(quantityPattern);
        if (quantityMatch) {
            const description = quantityMatch[1].trim();
            if (description.length > 2 && !ignorePattern.test(description)) {
                const quantity = parseNumber(quantityMatch[2]);
                const unitPrice = parseCurrency(quantityMatch[3]);
                const total = parseCurrency(quantityMatch[4]);
                const key = `${description}-${total ?? 'na'}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    items.push({ description, quantity, unitPrice, total });
                }
            }
            continue;
        }

        const priceMatch = line.match(pricePattern);
        if (priceMatch) {
            const description = priceMatch[1].trim();
            if (description.length > 2 && !ignorePattern.test(description)) {
                const total = parseCurrency(priceMatch[2]);
                const key = `${description}-${total ?? 'na'}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    items.push({ description, total });
                }
            }
        }
    }

    return items;
}

function parseCurrency(value: string): number | null {
    const normalized = parseFloat(value.replace(/,/g, ''));
    return Number.isNaN(normalized) ? null : normalized;
}

function parseNumber(value: string): number | null {
    const normalized = parseFloat(value);
    return Number.isNaN(normalized) ? null : normalized;
}

function normalizeDate(value: string): string | null {
    try {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

function normalizeOcrConfidence(value?: number | null): number | null {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return null;
    }
    const normalized = value > 1 ? value / 100 : value;
    return clamp(normalized, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function roundCurrency(value: number): number {
    return Number(value.toFixed(2));
}
