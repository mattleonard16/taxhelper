import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getInsightCacheTtlMs } from '../cache-policy';

const MS_PER_HOUR = 60 * 60 * 1000;

describe('cache-policy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses production default when NODE_ENV is production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.INSIGHT_CACHE_TTL_HOURS;

    expect(getInsightCacheTtlMs()).toBe(6 * MS_PER_HOUR);
  });

  it('uses development default when NODE_ENV is not production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.INSIGHT_CACHE_TTL_HOURS;

    expect(getInsightCacheTtlMs()).toBe(1 * MS_PER_HOUR);
  });

  it('uses env override when INSIGHT_CACHE_TTL_HOURS is set', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.INSIGHT_CACHE_TTL_HOURS = '2';

    expect(getInsightCacheTtlMs()).toBe(2 * MS_PER_HOUR);
  });
});
