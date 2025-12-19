/**
 * Environment variable validation
 * Validates required environment variables at startup and provides typed access
 */

interface EnvConfig {
    DATABASE_URL: string;
    NEXTAUTH_URL: string;
    NEXTAUTH_SECRET: string;
    // Optional
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    EMAIL_SERVER?: string;
    EMAIL_FROM?: string;
    UPSTASH_REDIS_REST_URL?: string;
    UPSTASH_REDIS_REST_TOKEN?: string;
    INSIGHT_CACHE_TTL_HOURS?: string;
}

const requiredEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
] as const;

/**
 * Validates that all required environment variables are set
 * @throws Error with list of missing variables if validation fails
 */
export function validateEnv(): EnvConfig {
    const missing: string[] = [];

    for (const key of requiredEnvVars) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            `Please check your .env file or environment configuration.`
        );
    }

    return {
        DATABASE_URL: process.env.DATABASE_URL!,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        EMAIL_SERVER: process.env.EMAIL_SERVER,
        EMAIL_FROM: process.env.EMAIL_FROM,
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
        INSIGHT_CACHE_TTL_HOURS: process.env.INSIGHT_CACHE_TTL_HOURS,
    };
}

/**
 * Checks if rate limiting is configured
 * Rate limiting requires both Upstash Redis URL and token
 */
export function isRateLimitingEnabled(): boolean {
    return !!(
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
    );
}

/**
 * Gets the current environment mode
 */
export function getEnvMode(): 'development' | 'production' | 'test' {
    if (process.env.NODE_ENV === 'production') return 'production';
    if (process.env.NODE_ENV === 'test') return 'test';
    return 'development';
}
