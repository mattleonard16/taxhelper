/**
 * Tests for LLM production hardening modules
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import {
    LLMRateLimitError,
    LLMBudgetExceededError,
    LLMTimeoutError,
    LLMParsingError,
    LLMProviderError,
    isRetryableError,
} from '../errors';
import { withRetry } from '../retry';
import {
    createCostTracker,
    calculateCost,
} from '../cost-tracker';

const mockUsageModel = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
};

const mockPrisma = {
    llmDailyUsage: mockUsageModel,
} as unknown as Parameters<typeof createCostTracker>[0];

describe('LLM Errors', () => {
    it('LLMRateLimitError is retryable', () => {
        const error = new LLMRateLimitError('Rate limited', 5000);
        expect(error.retryable).toBe(true);
        expect(error.retryAfterMs).toBe(5000);
        expect(isRetryableError(error)).toBe(true);
    });

    it('LLMBudgetExceededError is not retryable', () => {
        const error = new LLMBudgetExceededError('user123', 5.0, 6.5);
        expect(error.retryable).toBe(false);
        expect(error.userId).toBe('user123');
        expect(error.budgetUsd).toBe(5.0);
        expect(error.usedUsd).toBe(6.5);
        expect(isRetryableError(error)).toBe(false);
    });

    it('LLMTimeoutError is retryable', () => {
        const error = new LLMTimeoutError('Timeout');
        expect(error.retryable).toBe(true);
        expect(isRetryableError(error)).toBe(true);
    });

    it('LLMParsingError is not retryable', () => {
        const error = new LLMParsingError('Parse failed', '{"invalid":');
        expect(error.retryable).toBe(false);
        expect(error.rawResponse).toBe('{"invalid":');
        expect(isRetryableError(error)).toBe(false);
    });

    it('LLMProviderError 429 is retryable', () => {
        const error = new LLMProviderError('Rate limited', 429, 'openai');
        expect(error.retryable).toBe(true);
        expect(error.statusCode).toBe(429);
        expect(error.provider).toBe('openai');
    });

    it('LLMProviderError 400 is not retryable', () => {
        const error = new LLMProviderError('Bad request', 400, 'anthropic');
        expect(error.retryable).toBe(false);
    });

    it('isRetryableError detects retryable strings', () => {
        expect(isRetryableError(new Error('rate_limit exceeded'))).toBe(true);
        expect(isRetryableError(new Error('timeout occurred'))).toBe(true);
        expect(isRetryableError(new Error('server_error'))).toBe(true);
        expect(isRetryableError(new Error('invalid request'))).toBe(false);
    });
});

describe('withRetry', () => {
    it('succeeds on first try', async () => {
        const fn = vi.fn().mockResolvedValue('success');
        const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50, timeoutMs: 5000 });
        
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does not retry non-retryable errors', async () => {
        const fn = vi.fn().mockRejectedValue(new LLMParsingError('Parse failed'));
        
        await expect(
            withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 })
        ).rejects.toThrow('Parse failed');
        
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on retryable error and succeeds', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new LLMRateLimitError('Rate limited', 10))
            .mockResolvedValueOnce('success');

        const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 });
        
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('gives up after max retries', async () => {
        const fn = vi.fn().mockRejectedValue(new LLMTimeoutError('Timeout'));
        
        await expect(
            withRetry(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 })
        ).rejects.toThrow('Timeout');
        
        expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
});

describe('Cost Tracker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('calculates cost correctly for gpt-4o-mini', () => {
        // gpt-4o-mini: $0.15 input, $0.60 output per million
        const cost = calculateCost('gpt-4o-mini', 1000, 500);
        expect(cost).toBeCloseTo(0.00015 + 0.0003, 6);
    });

    it('calculates cost correctly for claude-3-haiku', () => {
        // claude-3-haiku: $0.25 input, $1.25 output per million
        const cost = calculateCost('claude-3-haiku-20240307', 1000, 500);
        expect(cost).toBeCloseTo(0.00025 + 0.000625, 6);
    });

    it('records usage in the daily usage row', async () => {
        vi.useFakeTimers();
        const now = new Date('2024-01-15T10:00:00Z');
        vi.setSystemTime(now);

        const tracker = createCostTracker(mockPrisma);
        await tracker.recordUsage('user1', 1000, 500, 'gpt-4o-mini');

        const cost = calculateCost('gpt-4o-mini', 1000, 500);
        expect(mockUsageModel.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    userId_date: {
                        userId: 'user1',
                        date: new Date('2024-01-15T00:00:00.000Z'),
                    },
                },
                create: expect.objectContaining({
                    userId: 'user1',
                    date: new Date('2024-01-15T00:00:00.000Z'),
                    totalCostUsd: cost,
                    requestCount: 1,
                }),
                update: expect.objectContaining({
                    totalCostUsd: { increment: cost },
                    requestCount: { increment: 1 },
                }),
            })
        );

        vi.useRealTimers();
    });

    it('returns null when no usage exists', async () => {
        mockUsageModel.findUnique.mockResolvedValue(null);

        const tracker = createCostTracker(mockPrisma);
        const usage = await tracker.getUsage('user1');

        expect(usage).toBeNull();
    });

    it('returns usage with normalized totals', async () => {
        mockUsageModel.findUnique.mockResolvedValue({
            userId: 'user1',
            date: new Date('2024-01-15T00:00:00.000Z'),
            totalCostUsd: new Prisma.Decimal('2.5'),
            requestCount: 2,
        });

        const tracker = createCostTracker(mockPrisma);
        const usage = await tracker.getUsage('user1');

        expect(usage).toEqual({
            userId: 'user1',
            date: '2024-01-15',
            totalCostUsd: 2.5,
            requestCount: 2,
        });
    });

    it('checkBudget returns remaining budget', async () => {
        mockUsageModel.findUnique.mockResolvedValue({
            userId: 'user1',
            date: new Date('2024-01-15T00:00:00.000Z'),
            totalCostUsd: new Prisma.Decimal('1.25'),
            requestCount: 1,
        });

        const tracker = createCostTracker(mockPrisma);
        const budget = await tracker.checkBudget('user1');

        expect(budget.exceeded).toBe(false);
        expect(budget.remaining).toBeGreaterThan(0);
        expect(budget.used).toBeCloseTo(1.25, 6);
    });
});
