/**
 * Receipt extraction cache using file SHA256 hash
 * Caches LLM results to avoid redundant API calls for duplicate receipts
 */

import { createHash } from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import type { ReceiptExtraction } from './receipt-ocr';

const DEFAULT_TTL_DAYS = parseInt(process.env.LLM_CACHE_TTL_DAYS || '7', 10);
const DEFAULT_TTL_MS = DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface CacheEntry {
    result: ReceiptExtraction;
    cachedAt: Date;
    expiresAt: Date;
}

export interface ReceiptCache {
    get(hash: string): Promise<ReceiptExtraction | null>;
    set(hash: string, result: ReceiptExtraction, ttlMs?: number): Promise<void>;
    delete(hash: string): Promise<void>;
    clear(): Promise<void>;
}

export function computeFileHash(data: ArrayBuffer): string {
    const buffer = Buffer.from(data);
    return createHash('sha256').update(buffer).digest('hex');
}

class PrismaReceiptCache implements ReceiptCache {
    constructor(private client: PrismaClient) { }

    async get(hash: string): Promise<ReceiptExtraction | null> {
        const entry = await this.client.receiptExtractionCache.findUnique({
            where: { hash },
        });

        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expiresAt.getTime()) {
            await this.client.receiptExtractionCache.deleteMany({ where: { hash } });
            logger.info('Receipt cache miss (expired)', { hash: hash.slice(0, 8) });
            return null;
        }

        logger.info('Receipt cache hit', { hash: hash.slice(0, 8) });
        return entry.result as unknown as ReceiptExtraction;
    }

    async set(hash: string, result: ReceiptExtraction, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlMs);

        await this.client.receiptExtractionCache.upsert({
            where: { hash },
            create: {
                hash,
                result: result as unknown as Prisma.InputJsonValue,
                cachedAt: now,
                expiresAt,
            },
            update: {
                result: result as unknown as Prisma.InputJsonValue,
                cachedAt: now,
                expiresAt,
            },
        });

        logger.info('Receipt cached', {
            hash: hash.slice(0, 8),
            ttlDays: ttlMs / (24 * 60 * 60 * 1000),
        });
    }

    async delete(hash: string): Promise<void> {
        await this.client.receiptExtractionCache.deleteMany({ where: { hash } });
    }

    async clear(): Promise<void> {
        await this.client.receiptExtractionCache.deleteMany({});
    }
}

let cacheInstance: ReceiptCache | null = null;

export function createReceiptCache(client: PrismaClient = prisma): ReceiptCache {
    return new PrismaReceiptCache(client);
}

export function getReceiptCache(): ReceiptCache {
    if (!cacheInstance) {
        cacheInstance = createReceiptCache(prisma);
    }
    return cacheInstance;
}

export async function getCachedExtraction(
    imageData: ArrayBuffer
): Promise<{ hash: string; cached: ReceiptExtraction | null }> {
    const hash = computeFileHash(imageData);
    const cache = getReceiptCache();
    const cached = await cache.get(hash);
    return { hash, cached };
}

export async function cacheExtraction(
    hash: string,
    result: ReceiptExtraction
): Promise<void> {
    const cache = getReceiptCache();
    await cache.set(hash, result);
}

export function _resetCacheForTesting(cache?: ReceiptCache): void {
    cacheInstance = cache ?? null;
}

export function getCacheTTLDays(): number {
    return DEFAULT_TTL_DAYS;
}
