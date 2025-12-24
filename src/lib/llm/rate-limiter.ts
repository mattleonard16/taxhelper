/**
 * Rate limiting for LLM API calls
 * - Per-user limit: 10 requests per minute
 * - Global limit: 60 requests per minute
 */

import { checkRateLimit, RateLimitResult } from '@/lib/rate-limit';
import { LLMRateLimitError } from './errors';

const LLM_USER_LIMIT = parseInt(process.env.LLM_RATE_LIMIT_PER_MINUTE || '10', 10);
const LLM_GLOBAL_LIMIT = 60;

export interface LLMRateLimitConfig {
    userLimit: number;
    globalLimit: number;
    window: string;
}

const DEFAULT_CONFIG: LLMRateLimitConfig = {
    userLimit: LLM_USER_LIMIT,
    globalLimit: LLM_GLOBAL_LIMIT,
    window: '1 m',
};

export interface LLMRateLimitResult {
    allowed: boolean;
    userResult: RateLimitResult;
    globalResult: RateLimitResult;
    retryAfterMs?: number;
}

export async function checkLLMRateLimit(
    userId: string,
    config: Partial<LLMRateLimitConfig> = {}
): Promise<LLMRateLimitResult> {
    const opts = { ...DEFAULT_CONFIG, ...config };

    const [userResult, globalResult] = await Promise.all([
        checkRateLimit(`llm:user:${userId}`, {
            requests: opts.userLimit,
            window: opts.window,
        }),
        checkRateLimit('llm:global', {
            requests: opts.globalLimit,
            window: opts.window,
        }),
    ]);

    const allowed = userResult.success && globalResult.success;
    let retryAfterMs: number | undefined;

    if (!allowed) {
        const userRetryAfter = userResult.success ? 0 : userResult.reset - Date.now();
        const globalRetryAfter = globalResult.success ? 0 : globalResult.reset - Date.now();
        retryAfterMs = Math.max(userRetryAfter, globalRetryAfter, 1000);
    }

    return {
        allowed,
        userResult,
        globalResult,
        retryAfterMs,
    };
}

export async function enforceRateLimit(userId: string): Promise<void> {
    const result = await checkLLMRateLimit(userId);

    if (!result.allowed) {
        const reason = !result.userResult.success
            ? 'User rate limit exceeded'
            : 'Global rate limit exceeded';
        throw new LLMRateLimitError(reason, result.retryAfterMs);
    }
}

export function getLLMRateLimitConfig(): LLMRateLimitConfig {
    return DEFAULT_CONFIG;
}
