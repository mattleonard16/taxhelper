import { describe, it, expect } from 'vitest';
import {
    createTransactionSchema,
    updateTransactionSchema,
    createTemplateSchema,
    transactionQuerySchema,
    parseBody,
    parseQuery,
} from '../schemas';

describe('schemas', () => {
    describe('createTransactionSchema', () => {
        it('should validate a correct transaction', () => {
            const input = {
                date: '2024-01-15T10:00:00.000Z',
                type: 'SALES_TAX',
                totalAmount: 100.50,
                taxAmount: 8.25,
            };

            const result = createTransactionSchema.safeParse(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('SALES_TAX');
                expect(result.data.currency).toBe('USD'); // default
            }
        });

        it('should accept YYYY-MM-DD date format from HTML inputs', () => {
            const input = {
                date: '2024-01-15', // YYYY-MM-DD from <input type="date">
                type: 'SALES_TAX',
                totalAmount: 100,
                taxAmount: 8,
            };

            const result = createTransactionSchema.safeParse(input);

            expect(result.success).toBe(true);
        });

        it('should reject invalid transaction type', () => {
            const input = {
                date: '2024-01-15T10:00:00.000Z',
                type: 'INVALID_TYPE',
                totalAmount: 100,
                taxAmount: 8,
            };

            const result = createTransactionSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should reject negative total amount', () => {
            const input = {
                date: '2024-01-15T10:00:00.000Z',
                type: 'SALES_TAX',
                totalAmount: -100,
                taxAmount: 8,
            };

            const result = createTransactionSchema.safeParse(input);

            expect(result.success).toBe(false);
            if (!result.success) {
                const messages = result.error.issues.map(issue => issue.message).join(' ');
                expect(messages).toContain('positive');
            }
        });

        it('should reject invalid date format', () => {
            const input = {
                date: 'not-a-date',
                type: 'SALES_TAX',
                totalAmount: 100,
                taxAmount: 8,
            };

            const result = createTransactionSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should allow optional fields to be null', () => {
            const input = {
                date: '2024-01-15T10:00:00.000Z',
                type: 'SALES_TAX',
                totalAmount: 100,
                taxAmount: 8,
                description: null,
                merchant: null,
            };

            const result = createTransactionSchema.safeParse(input);

            expect(result.success).toBe(true);
        });
    });

    describe('updateTransactionSchema', () => {
        it('should allow partial updates', () => {
            const input = {
                taxAmount: 10.50,
            };

            const result = updateTransactionSchema.safeParse(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.taxAmount).toBe(10.50);
                expect(result.data.date).toBeUndefined();
            }
        });

        it('should allow empty object', () => {
            const result = updateTransactionSchema.safeParse({});

            expect(result.success).toBe(true);
        });
    });

    describe('createTemplateSchema', () => {
        it('should validate a correct template', () => {
            const input = {
                label: 'NYC Sales Tax',
                taxRate: 0.08875,
                type: 'SALES_TAX',
            };

            const result = createTemplateSchema.safeParse(input);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isDefault).toBe(false); // default
            }
        });

        it('should reject tax rate above 1', () => {
            const input = {
                label: 'Test',
                taxRate: 8.875, // Should be 0.08875
                type: 'SALES_TAX',
            };

            const result = createTemplateSchema.safeParse(input);

            expect(result.success).toBe(false);
        });

        it('should require label', () => {
            const input = {
                taxRate: 0.08,
                type: 'SALES_TAX',
            };

            const result = createTemplateSchema.safeParse(input);

            expect(result.success).toBe(false);
        });
    });

    describe('transactionQuerySchema', () => {
        it('should parse query with defaults', () => {
            const result = transactionQuerySchema.safeParse({});

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.limit).toBe(20);
            }
        });

        it('should coerce string numbers', () => {
            const result = transactionQuerySchema.safeParse({
                page: '3',
                limit: '50',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(3);
                expect(result.data.limit).toBe(50);
            }
        });

        it('should parse ids as a comma-separated list', () => {
            const result = transactionQuerySchema.safeParse({
                ids: 'id1, id2,,id3',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toEqual(['id1', 'id2', 'id3']);
            }
        });

        it('should treat empty ids as undefined', () => {
            const result = transactionQuerySchema.safeParse({
                ids: '',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ids).toBeUndefined();
            }
        });

        it('should reject limit over 100', () => {
            const result = transactionQuerySchema.safeParse({
                limit: '200',
            });

            expect(result.success).toBe(false);
        });

        // Empty string normalization tests
        it('should normalize empty strings to undefined', () => {
            const result = transactionQuerySchema.safeParse({
                from: '',
                to: '',
                type: '',
                search: '',
                category: '',
                priority: '',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.from).toBeUndefined();
                expect(result.data.to).toBeUndefined();
                expect(result.data.type).toBeUndefined();
                expect(result.data.search).toBeUndefined();
                expect(result.data.category).toBeUndefined();
                expect(result.data.priority).toBeUndefined();
            }
        });

        it('should parse valid priority', () => {
            const result = transactionQuerySchema.safeParse({
                priority: 'HIGH',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.priority).toBe('HIGH');
            }
        });

        it('should normalize empty page/limit to defaults', () => {
            const result = transactionQuerySchema.safeParse({
                page: '',
                limit: '',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.limit).toBe(20);
            }
        });

        // NaN handling tests
        it('should treat NaN minAmount as undefined', () => {
            const result = transactionQuerySchema.safeParse({
                minAmount: 'not-a-number',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.minAmount).toBeUndefined();
            }
        });

        it('should treat NaN maxAmount as undefined', () => {
            const result = transactionQuerySchema.safeParse({
                maxAmount: 'abc',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.maxAmount).toBeUndefined();
            }
        });

        // Invalid enum tests
        it('should reject invalid category code', () => {
            const result = transactionQuerySchema.safeParse({
                category: 'INVALID_CATEGORY',
            });

            expect(result.success).toBe(false);
        });

        it('should accept valid category codes', () => {
            const validCodes = ['MEALS', 'TRAVEL', 'OFFICE', 'UTILITIES', 'SOFTWARE', 'PROFESSIONAL', 'OTHER'];
            for (const code of validCodes) {
                const result = transactionQuerySchema.safeParse({ category: code });
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.category).toBe(code);
                }
            }
        });

        it('should reject invalid transaction type', () => {
            const result = transactionQuerySchema.safeParse({
                type: 'INVALID_TYPE',
            });

            expect(result.success).toBe(false);
        });

        // Range validation tests
        it('should reject minAmount > maxAmount', () => {
            const result = transactionQuerySchema.safeParse({
                minAmount: '100',
                maxAmount: '50',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message).join(' ');
                expect(messages).toContain('minAmount cannot exceed maxAmount');
            }
        });

        it('should reject from date after to date', () => {
            const result = transactionQuerySchema.safeParse({
                from: '2024-12-31',
                to: '2024-01-01',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                const messages = result.error.issues.map(i => i.message).join(' ');
                expect(messages).toContain('from date cannot be after to date');
            }
        });

        it('should accept valid date range', () => {
            const result = transactionQuerySchema.safeParse({
                from: '2024-01-01',
                to: '2024-12-31',
            });

            expect(result.success).toBe(true);
        });

        it('should accept equal min/max amounts', () => {
            const result = transactionQuerySchema.safeParse({
                minAmount: '50',
                maxAmount: '50',
            });

            expect(result.success).toBe(true);
        });

        // isDeductible normalization
        it('should normalize empty isDeductible to undefined', () => {
            const result = transactionQuerySchema.safeParse({
                isDeductible: '',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isDeductible).toBeUndefined();
            }
        });

        it('should parse isDeductible true/false strings', () => {
            const trueResult = transactionQuerySchema.safeParse({ isDeductible: 'true' });
            const falseResult = transactionQuerySchema.safeParse({ isDeductible: 'false' });

            expect(trueResult.success).toBe(true);
            expect(falseResult.success).toBe(true);
            if (trueResult.success) expect(trueResult.data.isDeductible).toBe(true);
            if (falseResult.success) expect(falseResult.data.isDeductible).toBe(false);
        });
    });

    describe('parseBody', () => {
        it('should return success with valid data', () => {
            const result = parseBody(createTransactionSchema, {
                date: '2024-01-15T10:00:00.000Z',
                type: 'SALES_TAX',
                totalAmount: 100,
                taxAmount: 8,
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('SALES_TAX');
            }
        });

        it('should return formatted error message', () => {
            const result = parseBody(createTransactionSchema, {
                date: 'not-a-date',
                type: 'INVALID',
                totalAmount: -5,
                taxAmount: 0,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeTruthy();
                expect(typeof result.error).toBe('string');
            }
        });
    });

    describe('parseQuery', () => {
        it('should parse URLSearchParams', () => {
            const params = new URLSearchParams();
            params.set('page', '2');
            params.set('limit', '25');

            const result = parseQuery(transactionQuerySchema, params);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(2);
                expect(result.data.limit).toBe(25);
            }
        });
    });
});
