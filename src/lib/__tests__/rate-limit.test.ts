import { describe, it, expect, vi } from 'vitest';
import { checkRateLimit, RateLimitConfig } from '../rate-limit';

// Mock the env module with all required exports
vi.mock('../env', () => ({
    isRateLimitingEnabled: vi.fn(() => false), // Use in-memory for tests
    validateEnv: vi.fn(() => ({})), // Mock validateEnv
}));

describe('rate-limit', () => {
    describe('checkRateLimit with in-memory limiter', () => {
        it('should allow requests within limit', async () => {
            const identifier = `test-user-${Date.now()}`;

            const result = await checkRateLimit(identifier, { requests: 5, window: '1 m' });

            expect(result.success).toBe(true);
            expect(result.remaining).toBe(4);
        });

        it('should include rate limit headers', async () => {
            const identifier = `headers-test-${Date.now()}`;

            const result = await checkRateLimit(identifier, { requests: 10, window: '1 m' });

            expect(result.headers.get('X-RateLimit-Limit')).toBe('10');
            expect(result.headers.get('X-RateLimit-Remaining')).toBe('9');
            expect(result.headers.get('X-RateLimit-Reset')).toBeTruthy();
        });

        it('should decrement remaining on each request', async () => {
            const identifier = `decrement-test-${Date.now()}`;

            const result1 = await checkRateLimit(identifier, { requests: 5, window: '1 m' });
            expect(result1.remaining).toBe(4);

            const result2 = await checkRateLimit(identifier, { requests: 5, window: '1 m' });
            expect(result2.remaining).toBe(3);

            const result3 = await checkRateLimit(identifier, { requests: 5, window: '1 m' });
            expect(result3.remaining).toBe(2);
        });

        it('should reject requests over limit', async () => {
            const identifier = `limit-test-${Date.now()}`;
            const config = { requests: 2, window: '1 m' };

            await checkRateLimit(identifier, config); // 1st - remaining: 1
            await checkRateLimit(identifier, config); // 2nd - remaining: 0
            const result = await checkRateLimit(identifier, config); // 3rd - should fail

            expect(result.success).toBe(false);
            expect(result.remaining).toBe(0);
        });
    });

    describe('RateLimitConfig', () => {
        it('should have api config', () => {
            expect(RateLimitConfig.api.requests).toBe(100);
            expect(RateLimitConfig.api.window).toBe('1 m');
        });

        it('should have mutation config', () => {
            expect(RateLimitConfig.mutation.requests).toBe(30);
        });

        it('should have auth config', () => {
            expect(RateLimitConfig.auth.requests).toBe(10);
        });
    });
});
