/**
 * Custom error types for LLM operations
 */

export class LLMError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly retryable: boolean = false
    ) {
        super(message);
        this.name = 'LLMError';
    }
}

export class LLMRateLimitError extends LLMError {
    constructor(
        message: string = 'Rate limit exceeded',
        public readonly retryAfterMs?: number
    ) {
        super(message, 'RATE_LIMIT_EXCEEDED', true);
        this.name = 'LLMRateLimitError';
    }
}

export class LLMBudgetExceededError extends LLMError {
    constructor(
        public readonly userId: string,
        public readonly budgetUsd: number,
        public readonly usedUsd: number
    ) {
        super(
            `Daily budget exceeded for user ${userId}: $${usedUsd.toFixed(2)}/$${budgetUsd.toFixed(2)}`,
            'BUDGET_EXCEEDED',
            false
        );
        this.name = 'LLMBudgetExceededError';
    }
}

export class LLMTimeoutError extends LLMError {
    constructor(message: string = 'LLM request timed out') {
        super(message, 'TIMEOUT', true);
        this.name = 'LLMTimeoutError';
    }
}

export class LLMParsingError extends LLMError {
    constructor(
        message: string,
        public readonly rawResponse?: string
    ) {
        super(message, 'PARSING_ERROR', false);
        this.name = 'LLMParsingError';
    }
}

export class LLMProviderError extends LLMError {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly provider: string
    ) {
        const retryable = [429, 500, 502, 503, 504].includes(statusCode);
        super(message, `PROVIDER_ERROR_${statusCode}`, retryable);
        this.name = 'LLMProviderError';
    }
}

export function isRetryableError(error: unknown): boolean {
    if (error instanceof LLMError) {
        return error.retryable;
    }
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes('rate_limit') ||
            message.includes('timeout') ||
            message.includes('server_error') ||
            message.includes('econnreset') ||
            message.includes('socket hang up')
        );
    }
    return false;
}
