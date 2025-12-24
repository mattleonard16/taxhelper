/**
 * Tests for receipt cache
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReceiptExtraction } from '../receipt-ocr';
import {
    computeFileHash,
    getCachedExtraction,
    cacheExtraction,
    createReceiptCache,
    _resetCacheForTesting,
    type ReceiptCache,
} from '../receipt-cache';

const mockCacheModel = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
};

const mockPrisma = {
    receiptExtractionCache: mockCacheModel,
} as unknown as Parameters<typeof createReceiptCache>[0];

const mockExtraction: ReceiptExtraction = {
    merchant: 'Test Store',
    date: '2024-01-15',
    subtotal: 10.0,
    tax: 0.88,
    total: 10.88,
    items: [{ description: 'Item 1' }],
    confidence: 0.95,
    category: 'Other',
    categoryCode: 'OTHER',
    isDeductible: false,
};

describe('Receipt Cache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetCacheForTesting();
    });

    describe('computeFileHash', () => {
        it('computes consistent SHA256 hash', () => {
            const data = new TextEncoder().encode('test data').buffer;
            const hash1 = computeFileHash(data);
            const hash2 = computeFileHash(data);
            
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA256 hex length
        });

        it('computes different hashes for different data', () => {
            const data1 = new TextEncoder().encode('test data 1').buffer;
            const data2 = new TextEncoder().encode('test data 2').buffer;
            
            const hash1 = computeFileHash(data1);
            const hash2 = computeFileHash(data2);
            
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('cache operations', () => {
        it('returns null for cache miss', async () => {
            mockCacheModel.findUnique.mockResolvedValue(null);

            const cache = createReceiptCache(mockPrisma);
            const result = await cache.get('nonexistent');

            expect(result).toBeNull();
        });

        it('returns cached extraction when not expired', async () => {
            vi.useFakeTimers();
            const now = new Date('2024-01-15T00:00:00Z');
            vi.setSystemTime(now);
            const expiresAt = new Date(now.getTime() + 60 * 1000);
            mockCacheModel.findUnique.mockResolvedValue({
                hash: 'testhash123',
                result: mockExtraction,
                cachedAt: now,
                expiresAt,
            });

            const cache = createReceiptCache(mockPrisma);
            const result = await cache.get('testhash123');

            expect(result).toEqual(mockExtraction);
            expect(mockCacheModel.deleteMany).not.toHaveBeenCalled();
            vi.useRealTimers();
        });

        it('removes expired entries and returns null', async () => {
            const now = new Date('2024-01-15T00:00:00Z');
            const expiresAt = new Date(now.getTime() - 1000);
            mockCacheModel.findUnique.mockResolvedValue({
                hash: 'expiredhash',
                result: mockExtraction,
                cachedAt: now,
                expiresAt,
            });

            const cache = createReceiptCache(mockPrisma);
            const result = await cache.get('expiredhash');

            expect(result).toBeNull();
            expect(mockCacheModel.deleteMany).toHaveBeenCalledWith({ where: { hash: 'expiredhash' } });
        });

        it('upserts cached extraction with TTL', async () => {
            vi.useFakeTimers();
            const now = new Date('2024-01-15T12:00:00Z');
            vi.setSystemTime(now);

            const cache = createReceiptCache(mockPrisma);
            await cache.set('testhash123', mockExtraction, 60000);

            const expectedExpiresAt = new Date(now.getTime() + 60000);
            expect(mockCacheModel.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { hash: 'testhash123' },
                    create: expect.objectContaining({
                        hash: 'testhash123',
                        result: mockExtraction,
                        cachedAt: now,
                        expiresAt: expectedExpiresAt,
                    }),
                    update: expect.objectContaining({
                        result: mockExtraction,
                        cachedAt: now,
                        expiresAt: expectedExpiresAt,
                    }),
                })
            );

            vi.useRealTimers();
        });

        it('delete removes entry', async () => {
            const cache = createReceiptCache(mockPrisma);
            await cache.delete('testhash456');

            expect(mockCacheModel.deleteMany).toHaveBeenCalledWith({ where: { hash: 'testhash456' } });
        });

        it('clear removes all entries', async () => {
            const cache = createReceiptCache(mockPrisma);
            await cache.clear();

            expect(mockCacheModel.deleteMany).toHaveBeenCalledWith({});
        });
    });

    describe('getCachedExtraction', () => {
        it('returns hash and null for cache miss', async () => {
            const data = new TextEncoder().encode('new image data').buffer;
            const cacheMock: ReceiptCache = {
                get: vi.fn().mockResolvedValue(null),
                set: vi.fn(),
                delete: vi.fn(),
                clear: vi.fn(),
            };
            _resetCacheForTesting(cacheMock);

            const { hash, cached } = await getCachedExtraction(data);

            expect(hash).toHaveLength(64);
            expect(cacheMock.get).toHaveBeenCalledWith(hash);
            expect(cached).toBeNull();
        });

        it('returns cached result for known image', async () => {
            const data = new TextEncoder().encode('known image').buffer;
            const cacheMock: ReceiptCache = {
                get: vi.fn().mockResolvedValue(mockExtraction),
                set: vi.fn(),
                delete: vi.fn(),
                clear: vi.fn(),
            };
            _resetCacheForTesting(cacheMock);

            const { cached } = await getCachedExtraction(data);

            expect(cached).toEqual(mockExtraction);
        });

        it('writes to cache when caching extraction', async () => {
            const cacheMock: ReceiptCache = {
                get: vi.fn(),
                set: vi.fn(),
                delete: vi.fn(),
                clear: vi.fn(),
            };
            _resetCacheForTesting(cacheMock);

            await cacheExtraction('hash123', mockExtraction);

            expect(cacheMock.set).toHaveBeenCalledWith('hash123', mockExtraction);
        });
    });
});
