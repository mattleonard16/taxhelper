# TaxHelper: Production Hardening for LLM Integration

## Objective
Add retry logic, cost budgeting, rate limiting, and caching to the LLM-powered receipt extraction system for production reliability.

## Current State
- LLM extraction works via GPT-4o-mini
- No retry on failure
- No cost tracking or budgets
- No caching for repeated receipts

## Required Changes

### 1. Retry Logic with Exponential Backoff
**File**: `src/lib/llm/retry.ts` (NEW)

Create a retry wrapper:
```typescript
interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T>
```

Retryable errors:
- `rate_limit_exceeded`
- `timeout`
- `server_error`
- HTTP 429, 500, 502, 503

**File**: `src/lib/receipt/receipt-llm.ts`
- Wrap API calls with retry wrapper
- Default: 3 retries, 1s/5s/15s backoff

### 2. Cost Budgeting
**File**: `src/lib/llm/cost-tracker.ts` (NEW)

- Track cumulative cost per user/day
- Configurable daily budget via env: `LLM_DAILY_BUDGET_USD=5.00`
- Throw `BudgetExceededError` when limit hit

Implementation:
```typescript
interface CostTracker {
  recordUsage(userId: string, inputTokens: number, outputTokens: number, model: string): Promise<void>;
  checkBudget(userId: string): Promise<{ remaining: number; exceeded: boolean }>;
}
```

Storage: Redis (preferred) or in-memory with daily reset

**File**: `src/lib/receipt/receipt-llm.ts`
- Check budget before making LLM call
- Record usage after successful call

### 3. Rate Limiting
**File**: `src/lib/llm/rate-limiter.ts` (NEW)

Simple token bucket:
- 10 requests per minute per user
- 60 requests per minute global

**File**: `src/app/api/receipts/upload/route.ts`
- Apply rate limiter before processing
- Return 429 with Retry-After header

### 4. Receipt Hash Caching
**File**: `src/lib/receipt/receipt-cache.ts` (NEW)

Cache LLM results by file hash:
```typescript
interface ReceiptCache {
  get(hash: string): Promise<ReceiptExtraction | null>;
  set(hash: string, result: ReceiptExtraction, ttlSeconds: number): Promise<void>;
}
```

TTL: 7 days (receipts don't change)

**File**: `src/lib/receipt/receipt-llm.ts`
- Before LLM call: check cache by file SHA256
- After LLM call: cache result
- Skip LLM if cache hit

### 5. Environment Variables
Add to `.env.example`:
```
# LLM Production Settings
LLM_DAILY_BUDGET_USD=5.00
LLM_MAX_RETRIES=3
LLM_RATE_LIMIT_PER_MINUTE=10
LLM_CACHE_TTL_DAYS=7
```

### 6. Error Handling & Monitoring
**File**: `src/lib/llm/errors.ts` (NEW)

Custom error types:
- `LLMRateLimitError`
- `LLMBudgetExceededError`
- `LLMTimeoutError`
- `LLMParsingError`

**File**: `src/lib/receipt/receipt-job-worker.ts`
- Catch specific error types
- Set appropriate job status and error message
- Log structured errors for monitoring

## Verification
1. Test retry: Mock API to fail twice, then succeed
2. Test budget: Set low budget, exhaust it, verify rejection
3. Test rate limit: Send rapid requests, verify 429
4. Test cache: Upload same receipt twice, verify second is instant
5. Run `npm test` - all tests pass
6. Run `npm run build` - build succeeds
