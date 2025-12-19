/**
 * TDD Tests for Receipt Upload API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    logger: { error: vi.fn(), info: vi.fn() },
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
        expect(body.data.extracted.vendor).toBe('WALMART');
        expect(body.data.extracted.taxAmount).toBe(2.0);
        expect(body.data.extracted.totalAmount).toBe(27.0);
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
});
