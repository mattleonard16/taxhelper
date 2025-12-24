/**
 * Retry wrapper with exponential backoff for LLM API calls
 */

import { logger } from '@/lib/logger';
import { isRetryableError, LLMRateLimitError, LLMTimeoutError } from './errors';

export interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    timeoutMs?: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3', 10),
    baseDelayMs: 1000,
    maxDelayMs: 15000,
    timeoutMs: 30000,
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelayMs);
}

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string
): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new LLMTimeoutError(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId!);
    }
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    operationName: string = 'LLM operation'
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            const promise = fn();
            const result = opts.timeoutMs
                ? await withTimeout(promise, opts.timeoutMs, operationName)
                : await promise;
            
            if (attempt > 0) {
                logger.info(`${operationName} succeeded after ${attempt} retries`);
            }
            return result;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (error instanceof LLMRateLimitError && error.retryAfterMs) {
                const delay = Math.min(error.retryAfterMs, opts.maxDelayMs);
                logger.warn(`${operationName} rate limited, waiting ${delay}ms`, {
                    attempt,
                    retryAfterMs: error.retryAfterMs,
                });
                await sleep(delay);
                continue;
            }

            if (!isRetryableError(error) || attempt >= opts.maxRetries) {
                logger.error(`${operationName} failed permanently`, {
                    attempt,
                    error: lastError.message,
                    retryable: isRetryableError(error),
                });
                throw lastError;
            }

            const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
            logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
                attempt,
                error: lastError.message,
                nextAttempt: attempt + 1,
            });
            await sleep(delay);
        }
    }

    throw lastError || new Error(`${operationName} failed after ${opts.maxRetries} retries`);
}
