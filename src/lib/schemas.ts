/**
 * Request validation schemas using Zod
 * Provides runtime validation for API request bodies
 */

import { z } from 'zod';
import { CATEGORY_CODES } from './categories';

// Transaction type enum matching Prisma
export const TransactionTypeSchema = z.enum(['SALES_TAX', 'INCOME_TAX', 'OTHER']);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

// Transaction priority enum matching Prisma
export const TransactionPrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type TransactionPriority = z.infer<typeof TransactionPrioritySchema>;

// Date schema that accepts YYYY-MM-DD (from HTML date inputs) or full ISO datetime
export const dateStringSchema = z.string().refine(
    (val) => {
        // Accept YYYY-MM-DD or full ISO datetime
        const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
        const isoDatetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        return dateOnlyRegex.test(val) || isoDatetimeRegex.test(val);
    },
    { message: 'Invalid date format. Use YYYY-MM-DD or ISO 8601 format.' }
);

// Create transaction request
export const createTransactionSchema = z.object({
    date: dateStringSchema,
    type: TransactionTypeSchema,
    description: z.string().max(500).nullish(),
    merchant: z.string().max(200).nullish(),
    totalAmount: z.number().positive({ message: 'Total amount must be positive' }),
    taxAmount: z.number().nonnegative({ message: 'Tax amount cannot be negative' }),
    currency: z.string().length(3).default('USD'),
    receiptPath: z.string().max(500).nullish(),
    receiptName: z.string().max(200).nullish(),
    priority: TransactionPrioritySchema.default('MEDIUM'),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

// Update transaction request (all fields optional)
export const updateTransactionSchema = z.object({
    date: dateStringSchema.optional(),
    type: TransactionTypeSchema.optional(),
    description: z.string().max(500).nullish(),
    merchant: z.string().max(200).nullish(),
    totalAmount: z.number().positive().optional(),
    taxAmount: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    receiptPath: z.string().max(500).nullish(),
    receiptName: z.string().max(200).nullish(),
    priority: TransactionPrioritySchema.optional(),
});
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

// Create template request
export const createTemplateSchema = z.object({
    label: z.string().min(1, 'Label is required').max(100),
    merchant: z.string().max(200).nullish(),
    taxRate: z.number().min(0).max(1, 'Tax rate must be between 0 and 1 (e.g., 0.08 for 8%)'),
    type: TransactionTypeSchema,
    isDefault: z.boolean().default(false),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

// Update template request
export const updateTemplateSchema = z.object({
    label: z.string().min(1).max(100).optional(),
    merchant: z.string().max(200).nullish(),
    taxRate: z.number().min(0).max(1).optional(),
    type: TransactionTypeSchema.optional(),
    isDefault: z.boolean().optional(),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// Normalize empty strings to undefined
const emptyToUndefined = (val: unknown) => {
    if (val === '' || val === null) return undefined;
    return val;
};

// Coerce to number, treating NaN as undefined
const coerceNumberOrUndefined = z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const num = Number(val);
    if (Number.isNaN(num)) return undefined;
    return num;
}, z.number().nonnegative().optional());

// Valid category codes - imported from centralized categories.ts
export const VALID_CATEGORY_CODES = CATEGORY_CODES;
export const CategoryCodeSchema = z.enum(CATEGORY_CODES);

// Query params for transactions list - accepts YYYY-MM-DD
export const transactionQuerySchema = z.object({
    from: z.preprocess(emptyToUndefined, dateStringSchema.optional()),
    to: z.preprocess(emptyToUndefined, dateStringSchema.optional()),
    type: z.preprocess(emptyToUndefined, TransactionTypeSchema.optional()),
    search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
    minAmount: coerceNumberOrUndefined,
    maxAmount: coerceNumberOrUndefined,
    category: z.preprocess(emptyToUndefined, CategoryCodeSchema.optional()),
    isDeductible: z.preprocess(
        (val) => {
            if (val === '' || val === null || val === undefined) return undefined;
            if (val === 'true') return true;
            if (val === 'false') return false;
            return undefined;
        },
        z.boolean().optional()
    ),
    priority: z.preprocess(emptyToUndefined, TransactionPrioritySchema.optional()),
    ids: z.preprocess(
        (val) => {
            if (typeof val !== 'string' || val.trim() === '') return undefined;

            const ids = val
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

            return ids.length > 0 ? ids : undefined;
        },
        z.array(z.string().min(1)).max(200).optional()
    ),
    page: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? 1 : val),
        z.coerce.number().int().positive().default(1)
    ),
    limit: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? 20 : val),
        z.coerce.number().int().positive().max(100).default(20)
    ),
}).superRefine((data, ctx) => {
    // Validate date range: from must not be after to
    if (data.from && data.to) {
        const fromDate = new Date(data.from);
        const toDate = new Date(data.to);
        if (fromDate > toDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'from date cannot be after to date',
                path: ['from'],
            });
        }
    }
    // Validate amount range: min must not exceed max
    if (data.minAmount !== undefined && data.maxAmount !== undefined) {
        if (data.minAmount > data.maxAmount) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'minAmount cannot exceed maxAmount',
                path: ['minAmount'],
            });
        }
    }
});
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;

// Summary query params - accepts YYYY-MM-DD
export const summaryQuerySchema = z.object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
});
export type SummaryQueryInput = z.infer<typeof summaryQuerySchema>;

// Insights query params
export const insightsQuerySchema = z.object({
    range: z.coerce.number().int().positive().max(365).default(30),
});
export type InsightsQueryInput = z.infer<typeof insightsQuerySchema>;

export const insightStateSchema = z
    .object({
        dismissed: z.boolean().optional(),
        pinned: z.boolean().optional(),
    })
    .refine((data) => data.dismissed !== undefined || data.pinned !== undefined, {
        message: "At least one of dismissed or pinned must be provided",
    });
export type InsightStateInput = z.infer<typeof insightStateSchema>;

/**
 * Parses and validates request body with a Zod schema
 * Returns a result object with either data or error
 */
export function parseBody<T extends z.ZodSchema>(
    schema: T,
    data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
    const result = schema.safeParse(data);

    if (!result.success) {
        const issues = result.error.issues;
        const errorMessages = issues.map(issue => {
            const path = issue.path.join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
        });
        return { success: false, error: errorMessages.join('; ') };
    }

    return { success: true, data: result.data };
}

/**
 * Parses URL search params with a Zod schema
 */
export function parseQuery<T extends z.ZodSchema>(
    schema: T,
    searchParams: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; error: string } {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
        params[key] = value;
    });

    return parseBody(schema, params);
}
