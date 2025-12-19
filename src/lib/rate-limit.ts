/**
 * Rate limiting middleware using Upstash Redis
 * Falls back to in-memory rate limiting when Redis is not configured
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { isRateLimitingEnabled } from './env';
import { ApiErrors } from './api-utils';

// Rate limit configurations
export const RateLimitConfig = {
    // Standard API: 100 requests per minute
    api: { requests: 100, window: '1 m' as const },
    // Strict for mutations: 30 requests per minute
    mutation: { requests: 30, window: '1 m' as const },
    // Auth endpoints: 10 requests per minute
    auth: { requests: 10, window: '1 m' as const },
} as const;

/**
 * In-memory rate limiter for development/testing
 * Note: This doesn't work across serverless instances
 */
class InMemoryRateLimiter {
    private requests: Map<string, { count: number; resetTime: number }> = new Map();

    async limit(
        identifier: string,
        maxRequests: number,
        windowMs: number
    ): Promise<{ success: boolean; remaining: number; reset: number }> {
        const now = Date.now();
        const key = identifier;
        const record = this.requests.get(key);

        if (!record || now > record.resetTime) {
            this.requests.set(key, { count: 1, resetTime: now + windowMs });
            return { success: true, remaining: maxRequests - 1, reset: now + windowMs };
        }

        record.count++;
        const remaining = Math.max(0, maxRequests - record.count);
        const success = record.count <= maxRequests;

        return { success, remaining, reset: record.resetTime };
    }
}

// Singleton instances
let redisRateLimiter: Ratelimit | null = null;
let memoryRateLimiter: InMemoryRateLimiter | null = null;
const customLimiters = new Map<string, Ratelimit>();
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
    }
    return redisClient;
}

/**
 * Gets or creates the rate limiter
 */
function getRateLimiter(): Ratelimit | InMemoryRateLimiter {
    if (isRateLimitingEnabled()) {
        if (!redisRateLimiter) {
            const redis = getRedisClient();
            redisRateLimiter = new Ratelimit({
                redis,
                limiter: Ratelimit.slidingWindow(RateLimitConfig.api.requests, RateLimitConfig.api.window),
                analytics: true,
                prefix: 'taxhelper:ratelimit',
            });
        }
        return redisRateLimiter;
    }

    // Fall back to in-memory for development
    if (!memoryRateLimiter) {
        memoryRateLimiter = new InMemoryRateLimiter();
    }
    return memoryRateLimiter;
}

/**
 * Parse window string to milliseconds
 */
function parseWindow(window: string): number {
    const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
    if (!match) return 60000; // default 1 minute

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return 60000;
    }
}

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    reset: number;
    headers: Headers;
}

/**
 * Check rate limit for a given identifier
 */
export async function checkRateLimit(
    identifier: string,
    config: { requests: number; window: string } = RateLimitConfig.api
): Promise<RateLimitResult> {
    const limiter = getRateLimiter();

    let success: boolean;
    let remaining: number;
    let reset: number;

    if (limiter instanceof Ratelimit) {
        // Upstash rate limiter - cache custom limiters by config
        const cacheKey = `${config.requests}:${config.window}`;
        let customLimiter = customLimiters.get(cacheKey);

        if (!customLimiter) {
            const redis = getRedisClient();
            const prefixKey = cacheKey.replace(/\s+/g, '');
            customLimiter = new Ratelimit({
                redis,
                limiter: Ratelimit.slidingWindow(
                    config.requests,
                    config.window as Parameters<typeof Ratelimit.slidingWindow>[1]
                ),
                prefix: `taxhelper:ratelimit:${prefixKey}`,
            });
            customLimiters.set(cacheKey, customLimiter);
        }

        const result = await customLimiter.limit(identifier);
        success = result.success;
        remaining = result.remaining;
        reset = result.reset;
    } else {
        // In-memory fallback
        const windowMs = parseWindow(config.window);
        const result = await limiter.limit(identifier, config.requests, windowMs);
        success = result.success;
        remaining = result.remaining;
        reset = result.reset;
    }

    const headers = new Headers();
    headers.set('X-RateLimit-Limit', String(config.requests));
    headers.set('X-RateLimit-Remaining', String(remaining));
    headers.set('X-RateLimit-Reset', String(reset));

    return { success, remaining, reset, headers };
}

/**
 * Rate limit response with appropriate headers
 */
export function rateLimitedResponse(result: RateLimitResult): NextResponse {
    const response = ApiErrors.rateLimited();
    result.headers.forEach((value, key) => {
        response.headers.set(key, value);
    });
    response.headers.set('Retry-After', String(Math.ceil((result.reset - Date.now()) / 1000)));
    return response;
}
