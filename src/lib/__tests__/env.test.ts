import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEnv, isRateLimitingEnabled, getEnvMode } from '../env';

describe('env', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('validateEnv', () => {
        it('should return config when all required vars are set', () => {
            process.env.DATABASE_URL = 'postgresql://localhost/test';
            process.env.NEXTAUTH_URL = 'http://localhost:3000';
            process.env.NEXTAUTH_SECRET = 'test-secret';

            const config = validateEnv();

            expect(config.DATABASE_URL).toBe('postgresql://localhost/test');
            expect(config.NEXTAUTH_URL).toBe('http://localhost:3000');
            expect(config.NEXTAUTH_SECRET).toBe('test-secret');
        });

        it('should throw when DATABASE_URL is missing', () => {
            process.env.NEXTAUTH_URL = 'http://localhost:3000';
            process.env.NEXTAUTH_SECRET = 'test-secret';
            delete process.env.DATABASE_URL;

            expect(() => validateEnv()).toThrow('Missing required environment variables: DATABASE_URL');
        });

        it('should throw when multiple vars are missing', () => {
            delete process.env.DATABASE_URL;
            delete process.env.NEXTAUTH_URL;
            delete process.env.NEXTAUTH_SECRET;

            expect(() => validateEnv()).toThrow('DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET');
        });

        it('should include optional vars when present', () => {
            process.env.DATABASE_URL = 'postgresql://localhost/test';
            process.env.NEXTAUTH_URL = 'http://localhost:3000';
            process.env.NEXTAUTH_SECRET = 'test-secret';
            process.env.GOOGLE_CLIENT_ID = 'google-id';

            const config = validateEnv();

            expect(config.GOOGLE_CLIENT_ID).toBe('google-id');
        });

        it('should throw when NEXTAUTH_URL is not a valid URL', () => {
            process.env.DATABASE_URL = 'postgresql://localhost/test';
            process.env.NEXTAUTH_URL = 'not-a-url';
            process.env.NEXTAUTH_SECRET = 'test-secret';

            expect(() => validateEnv()).toThrow('NEXTAUTH_URL must be a valid http(s) URL');
        });

        it('should throw when NEXTAUTH_URL is not http or https', () => {
            process.env.DATABASE_URL = 'postgresql://localhost/test';
            process.env.NEXTAUTH_URL = 'ftp://localhost:3000';
            process.env.NEXTAUTH_SECRET = 'test-secret';

            expect(() => validateEnv()).toThrow('NEXTAUTH_URL must be a valid http(s) URL');
        });

        it('should warn when Google OAuth is missing outside test', () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
            process.env.DATABASE_URL = 'postgresql://localhost/test';
            process.env.NEXTAUTH_URL = 'http://localhost:3000';
            process.env.NEXTAUTH_SECRET = 'test-secret';
            delete process.env.GOOGLE_CLIENT_ID;
            delete process.env.GOOGLE_CLIENT_SECRET;

            validateEnv();

            expect(warnSpy).toHaveBeenCalledWith(
                '[env] Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in.'
            );
            warnSpy.mockRestore();
        });
    });

    describe('isRateLimitingEnabled', () => {
        it('should return true when both Upstash vars are set', () => {
            process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io';
            process.env.UPSTASH_REDIS_REST_TOKEN = 'token123';

            expect(isRateLimitingEnabled()).toBe(true);
        });

        it('should return false when URL is missing', () => {
            delete process.env.UPSTASH_REDIS_REST_URL;
            process.env.UPSTASH_REDIS_REST_TOKEN = 'token123';

            expect(isRateLimitingEnabled()).toBe(false);
        });

        it('should return false when token is missing', () => {
            process.env.UPSTASH_REDIS_REST_URL = 'https://redis.upstash.io';
            delete process.env.UPSTASH_REDIS_REST_TOKEN;

            expect(isRateLimitingEnabled()).toBe(false);
        });
    });

    describe('getEnvMode', () => {
        it('should return production when NODE_ENV is production', () => {
            (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
            expect(getEnvMode()).toBe('production');
        });

        it('should return test when NODE_ENV is test', () => {
            (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
            expect(getEnvMode()).toBe('test');
        });

        it('should return development by default', () => {
            (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
            expect(getEnvMode()).toBe('development');
        });
    });
});
