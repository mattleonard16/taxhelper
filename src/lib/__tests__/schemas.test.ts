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
