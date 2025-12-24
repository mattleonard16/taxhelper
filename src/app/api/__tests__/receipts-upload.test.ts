/**
 * TDD Tests for Receipt Upload API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReceiptJobRepository } from '@/lib/receipt/receipt-job-repository';
import { POST } from '../receipts/upload/route';
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
}));

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({
        success: true,
        headers: new Map(),
    }),
    RateLimitConfig: { mutation: {} },
    rateLimitedResponse: () => new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
}));

vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/llm/rate-limiter', () => ({
    checkLLMRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: undefined }),
    enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/llm/cost-tracker', () => ({
    checkBudgetBeforeCall: vi.fn().mockResolvedValue(undefined),
    checkAndRecordUsage: vi.fn().mockResolvedValue(undefined),
    getDailyBudget: vi.fn(),
}));

vi.mock('@/lib/receipt/receipt-cache', () => ({
    getCachedExtraction: vi.fn().mockResolvedValue({ hash: 'mockhash', cached: null }),
    cacheExtraction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/receipt/receipt-job-repository', () => ({
    createReceiptJobRepository: vi.fn(),
}));

vi.mock('@/lib/receipt/receipt-storage', () => ({
    storeReceiptBytes: vi.fn(),
}));

describe('Receipt Upload API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 if not authenticated', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const formData = new FormData();
        formData.append('file', new Blob(['test'], { type: 'image/jpeg' }), 'test.jpg');

        const request = new NextRequest('http://localhost:3000/api/receipts/upload', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    it('should return 400 if no file provided', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const formData = new FormData();

        const request = new NextRequest('http://localhost:3000/api/receipts/upload', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toContain('No file');
    });

    it('should return 400 for invalid file type', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const formData = new FormData();
        formData.append('file', new Blob(['test'], { type: 'text/plain' }), 'test.txt');

        const request = new NextRequest('http://localhost:3000/api/receipts/upload', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toContain('Invalid file type');
    });

    it('should process valid image upload', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const formData = new FormData();
        const file = new File(['test image content'], 'receipt.jpg', { type: 'image/jpeg' });
        formData.append('file', file);
        formData.append('type', 'SALES_TAX');

        const request = new NextRequest('http://localhost:3000/api/receipts/upload', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const body = await response.json();
        
        // Debug: log the response if not 200
        if (response.status !== 200) {
            console.log('Upload failed:', body);
        }
        
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.filename).toMatch(/^\d{4}-\d{2}-\d{2}.*\.jpg$/);
        expect(body.data.storagePath).toContain('receipts/user-1/SALES_TAX');
    });

    it('should process OCR text when provided', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const formData = new FormData();
        const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
        formData.append('file', file);
        formData.append('ocrText', 'WALMART\nGroceries $25.00\nTAX $2.00\nTOTAL $27.00\n03/15/2024');
        formData.append('type', 'SALES_TAX');

        const request = new NextRequest('http://localhost:3000/api/receipts/upload', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.extracted.merchant).toBe('WALMART');
        expect(body.data.extracted.tax).toBe(2.0);
        expect(body.data.extracted.total).toBe(27.0);
    });

    it('does not check LLM rate limits when OCR confidence is high', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const { checkLLMRateLimit } = await import('@/lib/llm/rate-limiter');

        const formData = new FormData();
        const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
        formData.append('file', file);
        formData.append('ocrText', 'CLEAR TEXT TOTAL $12.34');
        formData.append('ocrConfidence', '0.95');

        const request = new NextRequest('http://localhost:3000/api/receipts/upload', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        expect(vi.mocked(checkLLMRateLimit)).not.toHaveBeenCalled();
    });

    it('should fall back to LLM when OCR confidence is low', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const originalKey = process.env.ANTHROPIC_API_KEY;
        process.env.ANTHROPIC_API_KEY = 'test-key';

        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            merchant: 'Cafe Nero',
                            date: '2024-03-12',
                            subtotal: 18.0,
                            tax: 1.5,
                            total: 19.5,
                            items: [{ description: 'Latte', quantity: 2, unitPrice: 5.0, total: 10.0 }],
                            confidence: 0.9,
                        }),
                    },
                ],
                usage: { input_tokens: 120, output_tokens: 80 },
            }),
        } as Response);

        const formData = new FormData();
        const file = new File(['test image content'], 'receipt.jpg', { type: 'image/jpeg' });
        formData.append('file', file);
        formData.append('ocrText', 'blurry text with no totals');
        formData.append('ocrConfidence', '0.2');

        const request = new NextRequest('http://localhost:3000/api/receipts/upload', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(fetchSpy).toHaveBeenCalled();
        expect(body.data.extracted.merchant).toBe('Cafe Nero');
        expect(body.data.extracted.total).toBe(19.5);

        fetchSpy.mockRestore();
        process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it('should generate invoice-organizer formatted filename', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const formData = new FormData();
        const file = new File(['test'], 'receipt.pdf', { type: 'application/pdf' });
        formData.append('file', file);
        formData.append('ocrText', 'TARGET\nShopping $100.00\nTAX $8.25\nTOTAL $108.25\n03/20/2024');

        const request = new NextRequest('http://localhost:3000/api/receipts/upload', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        
        const body = await response.json();

        // Filename should follow invoice-organizer format
        expect(body.data.filename).toMatch(/^\d{4}-\d{2}-\d{2} TARGET - Receipt.*\.pdf$/);
    });

    it('should queue async uploads and persist bytes', async () => {
        const { getAuthUser } = await import('@/lib/api-utils');
        vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1', email: 'test@test.com', name: 'Test' });

        const { createReceiptJobRepository } = await import('@/lib/receipt/receipt-job-repository');
        const { storeReceiptBytes } = await import('@/lib/receipt/receipt-storage');

        const create = vi.fn().mockResolvedValue({
            id: 'job-1',
            status: 'QUEUED',
            originalName: 'receipt.jpg',
        });
        vi.mocked(createReceiptJobRepository).mockReturnValue({ create } as unknown as ReceiptJobRepository);
        vi.mocked(storeReceiptBytes).mockResolvedValue(undefined);

        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));

        const formData = new FormData();
        const file = new File(['async test'], 'receipt.jpg', { type: 'image/jpeg' });
        formData.append('file', file);
        formData.append('type', 'SALES_TAX');

        const request = new NextRequest('http://localhost:3000/api/receipts/upload?async=1', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(202);
        expect(body.success).toBe(true);
        expect(body.async).toBe(true);
        expect(body.job.id).toBe('job-1');
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                storagePath: 'receipts/user-1/SALES_TAX/2024-03-15 Unknown - Receipt.jpg',
            })
        );
        expect(storeReceiptBytes).toHaveBeenCalledWith(
            'receipts/user-1/SALES_TAX/2024-03-15 Unknown - Receipt.jpg',
            expect.anything()
        );
        const storedBytes = vi.mocked(storeReceiptBytes).mock.calls[0]?.[1];
        expect(storedBytes).toBeTruthy();
        expect(typeof storedBytes.byteLength).toBe('number');
        expect(storedBytes.byteLength).toBeGreaterThan(0);

        vi.useRealTimers();
    });
});
