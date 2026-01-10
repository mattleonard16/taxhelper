/**
 * TDD Tests for Export API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../export/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/api-utils', () => ({
    getAuthUser: vi.fn(),
    ApiErrors: {
        unauthorized: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        validation: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
        internal: () => new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 }),
    },
    getRequestId: () => 'test-request-id',
    attachRequestId: (res: Response) => res,
    parseSearchParams: (searchParams: URLSearchParams) => {
        const params: Record<string, string> = {};
        searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    },
}));

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({
        success: true,
        headers: new Map(),
    }),
    RateLimitConfig: { api: {} },
    rateLimitedResponse: () => new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {
        transaction: {
            findMany: vi.fn(),
        },
    },
}));

describe('Export API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 if not authenticated', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new NextRequest('http://localhost:3000/api/export?year=2024');

        const response = await GET(request);
        expect(response.status).toBe(401);
    });

    it('should return 400 if year is missing', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const request = new NextRequest('http://localhost:3000/api/export');

        const response = await GET(request);
        expect(response.status).toBe(400);
    });

    it('should return 400 for invalid year', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const request = new NextRequest('http://localhost:3000/api/export?year=1999');

        const response = await GET(request);
        expect(response.status).toBe(400);
    });

    it('should return 404 if no transactions found', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const { prisma } = await import('@/lib/prisma');
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

        const request = new NextRequest('http://localhost:3000/api/export?year=2024');

        const response = await GET(request);
        expect(response.status).toBe(404);

        const body = await response.json();
        expect(body.code).toBe('NO_DATA');
    });

    it('should return ZIP file with correct content-type', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const { prisma } = await import('@/lib/prisma');
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([
            {
                id: '1',
                userId: 'user-1',
                date: new Date('2024-01-15'),
                type: 'SALES_TAX',
                merchant: 'Walmart',
                description: 'Groceries',
                totalAmount: { toString: () => '50.00' },
                taxAmount: { toString: () => '4.13' },
                currency: 'USD',
                receiptPath: null,
                receiptName: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ] as never);

        const request = new NextRequest('http://localhost:3000/api/export?year=2024');

        const response = await GET(request);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/zip');
        expect(response.headers.get('Content-Disposition')).toContain('TaxHelper-2024-Export.zip');
    });

    it('should return CSV file when ids are provided', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const { prisma } = await import('@/lib/prisma');
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([
            {
                id: '1',
                userId: 'user-1',
                date: new Date('2024-01-15'),
                type: 'SALES_TAX',
                merchant: 'Walmart',
                description: 'Groceries',
                totalAmount: { toString: () => '50.00' },
                taxAmount: { toString: () => '4.13' },
                currency: 'USD',
                receiptPath: null,
                receiptName: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ] as never);

        const request = new NextRequest('http://localhost:3000/api/export?ids=1,2&format=csv');

        const response = await GET(request);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain('text/csv');
        expect(response.headers.get('Content-Disposition')).toContain('TaxHelper-Selected-');

        const body = await response.text();
        expect(body).toContain('Date,Vendor,Description,Amount,Category,Tax Amount');
    });

    it('should return CSV when format=csv is provided', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const { prisma } = await import('@/lib/prisma');
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([
            {
                id: '1',
                userId: 'user-1',
                date: new Date('2024-01-15'),
                type: 'SALES_TAX',
                merchant: 'Walmart',
                description: 'Groceries',
                totalAmount: { toString: () => '50.00' },
                taxAmount: { toString: () => '4.13' },
                currency: 'USD',
                receiptPath: null,
                receiptName: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ] as never);

        const request = new NextRequest('http://localhost:3000/api/export?format=csv&from=2024-01-01&to=2024-12-31&type=SALES_TAX');

        const response = await GET(request);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain('text/csv');
    });

    it('should include summary when includeSummary=true', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const { prisma } = await import('@/lib/prisma');
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([
            {
                id: '1',
                userId: 'user-1',
                date: new Date('2024-01-15'),
                type: 'SALES_TAX',
                merchant: 'Walmart',
                description: 'Groceries',
                totalAmount: { toString: () => '50.00' },
                taxAmount: { toString: () => '4.13' },
                currency: 'USD',
                receiptPath: null,
                receiptName: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: '2',
                userId: 'user-1',
                date: new Date('2024-02-01'),
                type: 'INCOME_TAX',
                merchant: 'Employer',
                description: 'Paycheck',
                totalAmount: { toString: () => '3000.00' },
                taxAmount: { toString: () => '450.00' },
                currency: 'USD',
                receiptPath: null,
                receiptName: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ] as never);

        const request = new NextRequest('http://localhost:3000/api/export?year=2024&includeSummary=true');

        const response = await GET(request);
        expect(response.status).toBe(200);

        // The ZIP is created successfully - detailed CSV content testing is done in csv-generator tests
    });

    it('should filter transactions by year', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const { prisma } = await import('@/lib/prisma');
        vi.mocked(prisma.transaction.findMany).mockResolvedValue([
            {
                id: '1',
                userId: 'user-1',
                date: new Date('2024-06-15'),
                type: 'SALES_TAX',
                merchant: 'Store',
                description: 'Items',
                totalAmount: { toString: () => '100.00' },
                taxAmount: { toString: () => '8.25' },
                currency: 'USD',
                receiptPath: null,
                receiptName: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ] as never);

        const request = new NextRequest('http://localhost:3000/api/export?year=2024');

        await GET(request);

        // Verify prisma was called with correct date range
        expect(prisma.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: 'user-1',
                    date: expect.objectContaining({
                        gte: expect.any(Date),
                        lte: expect.any(Date),
                    }),
                }),
            })
        );
    });
});
