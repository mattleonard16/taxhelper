/**
 * Request validation schemas using Zod
 * Provides runtime validation for API request bodies
 */

import { z } from 'zod';

// Transaction type enum matching Prisma
export const TransactionTypeSchema = z.enum(['SALES_TAX', 'INCOME_TAX', 'OTHER']);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

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

// Query params for transactions list - accepts YYYY-MM-DD
export const transactionQuerySchema = z.object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    type: TransactionTypeSchema.optional(),
    search: z.string().max(200).optional(),
    minAmount: z.coerce.number().nonnegative().optional(),
    maxAmount: z.coerce.number().nonnegative().optional(),
    ids: z.preprocess(
        (val) => {
            if (typeof val !== 'string') return undefined;

            const ids = val
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

            return ids.length > 0 ? ids : undefined;
        },
        z.array(z.string().min(1)).max(200).optional()
    ),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
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
