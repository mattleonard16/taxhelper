/**
 * LLM-based receipt extraction for low-confidence OCR results.
 * Production hardened with retry, caching, rate limiting, and cost tracking.
 */

import { logger } from '@/lib/logger';
import { ReceiptExtraction, ReceiptItem, calculateReceiptConfidence } from './receipt-ocr';
import { arrayBufferToBase64 } from './receipt-utils';
import { withRetry } from '@/lib/llm/retry';
import { checkAndRecordUsage, checkBudgetBeforeCall } from '@/lib/llm/cost-tracker';
import { enforceRateLimit } from '@/lib/llm/rate-limiter';
import { getCachedExtraction, cacheExtraction } from './receipt-cache';
import { LLMProviderError, LLMParsingError, LLMRateLimitError } from '@/lib/llm/errors';
import { LLM_CATEGORY_PROMPT } from '@/lib/categories';

type LLMProvider = 'anthropic' | 'openai';

const DEFAULT_ANTHROPIC_MODEL = process.env.RECEIPT_LLM_MODEL_ANTHROPIC || 'claude-3-haiku-20240307';
const DEFAULT_OPENAI_MODEL = process.env.RECEIPT_LLM_MODEL_OPENAI || 'gpt-4o-mini';
const RAW_MAX_TOKENS = Number.parseInt(process.env.RECEIPT_LLM_MAX_TOKENS || '700', 10);
const DEFAULT_MAX_TOKENS = Number.isNaN(RAW_MAX_TOKENS) ? 700 : RAW_MAX_TOKENS;

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const RECEIPT_PROMPT = [
    'You are a receipt parsing assistant for grocery, restaurant, and retail receipts.',
    'Extract structured data from the receipt image.',
    'Return JSON only with these keys: merchant, date, subtotal, tax, total, items, category, categoryCode, isDeductible, confidence.',
    'Rules:',
    '- date must be YYYY-MM-DD or null.',
    '- monetary values must be numbers without currency symbols.',
    '- items is an array of { description, quantity, unitPrice, total }.',
    '- use null when values are missing.',
    '- confidence must be between 0 and 1 and reflect overall certainty.',
    '',
    LLM_CATEGORY_PROMPT,
    '',
    'Deductibility Rules (set isDeductible: true/false):',
    '- Business meals (50% deductible) → true',
    '- Home office supplies → true',
    '- Travel for work → true',
    '- Professional services for business → true',
    '- Personal groceries, entertainment → false',
    '- Healthcare (if self-employed or HSA eligible) → true',
].join('\n');

const MODEL_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-5-sonnet-20240620': { input: 3, output: 15 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4o': { input: 2.5, output: 10 },
};

export function isLLMConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

export function isLLMImageTypeSupported(mimeType: string): boolean {
    return SUPPORTED_IMAGE_TYPES.has(mimeType);
}

export async function extractReceiptWithLLM(options: {
    image: ArrayBuffer;
    mimeType: string;
    requestId?: string;
    userId?: string;
}): Promise<ReceiptExtraction> {
    const userId = options.userId || 'anonymous';

    // Check cache first
    const { hash, cached } = await getCachedExtraction(options.image);
    if (cached) {
        logger.info('Receipt extraction cache hit', {
            requestId: options.requestId,
            userId,
            hash: hash.slice(0, 8),
        });
        return cached;
    }

    // Check rate limit and budget before making the call
    await enforceRateLimit(userId);
    await checkBudgetBeforeCall(userId);

    const provider = resolveProvider();
    if (!provider) {
        throw new Error('No LLM provider configured');
    }

    const imageBase64 = arrayBufferToBase64(options.image);

    const callOptions = {
        apiKey: provider.apiKey,
        model: provider.model,
        imageBase64,
        mimeType: options.mimeType,
        requestId: options.requestId,
        userId,
    };

    // Use retry wrapper for API calls
    const result = await withRetry(
        async () => {
            if (provider.name === 'anthropic') {
                return callAnthropic(callOptions);
            }
            return callOpenAI(callOptions);
        },
        {},
        `Receipt extraction (${provider.name})`
    );

    // Cache the result
    await cacheExtraction(hash, result);

    return result;
}

function resolveProvider(): { name: LLMProvider; apiKey: string; model: string } | null {
    const preferred = process.env.RECEIPT_LLM_PROVIDER;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    if (preferred === 'openai' && openAiKey) {
        return { name: 'openai', apiKey: openAiKey, model: DEFAULT_OPENAI_MODEL };
    }
    if (preferred === 'anthropic' && anthropicKey) {
        return { name: 'anthropic', apiKey: anthropicKey, model: DEFAULT_ANTHROPIC_MODEL };
    }

    if (anthropicKey) {
        return { name: 'anthropic', apiKey: anthropicKey, model: DEFAULT_ANTHROPIC_MODEL };
    }
    if (openAiKey) {
        return { name: 'openai', apiKey: openAiKey, model: DEFAULT_OPENAI_MODEL };
    }

    return null;
}

async function callAnthropic(options: {
    apiKey: string;
    model: string;
    imageBase64: string;
    mimeType: string;
    requestId?: string;
    userId?: string;
}): Promise<ReceiptExtraction> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: options.model,
            max_tokens: DEFAULT_MAX_TOKENS,
            temperature: 0,
            system: RECEIPT_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract the receipt data.' },
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: options.mimeType,
                                data: options.imageBase64,
                            },
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            throw new LLMRateLimitError(
                'Anthropic rate limit exceeded',
                retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined
            );
        }
        throw new LLMProviderError(
            `Anthropic API error: ${response.status}`,
            response.status,
            'anthropic'
        );
    }

    const payload = await response.json();
    const content = Array.isArray(payload.content) ? payload.content : [];
    const text = content.find((item: { type?: string }) => item.type === 'text')?.text || '';
    
    let extracted: ReceiptExtraction;
    try {
        extracted = normalizeReceiptExtraction(parseJsonPayload(text));
    } catch (error) {
        throw new LLMParsingError(
            `Failed to parse Anthropic response: ${error instanceof Error ? error.message : 'unknown'}`,
            text
        );
    }

    const inputTokens = payload.usage?.input_tokens || 0;
    const outputTokens = payload.usage?.output_tokens || 0;

    // Record usage for cost tracking
    if (options.userId) {
        await checkAndRecordUsage(options.userId, inputTokens, outputTokens, options.model);
    }

    logUsage({
        provider: 'anthropic',
        model: options.model,
        inputTokens,
        outputTokens,
        requestId: options.requestId,
        userId: options.userId,
    });

    return extracted;
}

async function callOpenAI(options: {
    apiKey: string;
    model: string;
    imageBase64: string;
    mimeType: string;
    requestId?: string;
    userId?: string;
}): Promise<ReceiptExtraction> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
            model: options.model,
            max_tokens: DEFAULT_MAX_TOKENS,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: RECEIPT_PROMPT,
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract the receipt data.' },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${options.mimeType};base64,${options.imageBase64}`,
                            },
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            throw new LLMRateLimitError(
                'OpenAI rate limit exceeded',
                retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined
            );
        }
        throw new LLMProviderError(
            `OpenAI API error: ${response.status}`,
            response.status,
            'openai'
        );
    }

    const payload = await response.json();
    const message = payload.choices?.[0]?.message?.content || '';
    
    let extracted: ReceiptExtraction;
    try {
        extracted = normalizeReceiptExtraction(parseJsonPayload(message));
    } catch (error) {
        throw new LLMParsingError(
            `Failed to parse OpenAI response: ${error instanceof Error ? error.message : 'unknown'}`,
            message
        );
    }

    const inputTokens = payload.usage?.prompt_tokens || 0;
    const outputTokens = payload.usage?.completion_tokens || 0;

    // Record usage for cost tracking
    if (options.userId) {
        await checkAndRecordUsage(options.userId, inputTokens, outputTokens, options.model);
    }

    logUsage({
        provider: 'openai',
        model: options.model,
        inputTokens,
        outputTokens,
        requestId: options.requestId,
        userId: options.userId,
    });

    return extracted;
}

function parseJsonPayload(text: string): unknown {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('No JSON object found in LLM response');
    }
    const json = text.slice(start, end + 1);
    return JSON.parse(json);
}

function normalizeReceiptExtraction(raw: unknown): ReceiptExtraction {
    const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const itemsRaw = Array.isArray(record.items) ? record.items : [];
    const items = itemsRaw.map(normalizeReceiptItem).filter(Boolean) as ReceiptItem[];

    const merchant = normalizeString(record.merchant) || normalizeString(record.vendor);
    const date = normalizeDate(record.date);
    const subtotal = normalizeNumber(record.subtotal);
    const tax = normalizeNumber(record.tax);
    const total = normalizeNumber(record.total);

    const category = normalizeString(record.category) || 'Other';
    const categoryCode = normalizeString(record.categoryCode) || 'OTHER';
    const isDeductible = record.isDeductible === true;

    const extraction = {
        merchant,
        date,
        subtotal,
        tax,
        total,
        items,
        category,
        categoryCode,
        isDeductible,
    };

    const confidence = normalizeConfidence(record.confidence);

    return {
        ...extraction,
        confidence: confidence ?? calculateReceiptConfidence(extraction),
    };
}

function normalizeReceiptItem(item: unknown): ReceiptItem | null {
    if (typeof item === 'string') {
        const description = item.trim();
        return description ? { description } : null;
    }
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    const description = normalizeString(record.description) || normalizeString(record.name);
    if (!description) return null;

    return {
        description,
        quantity: normalizeNumber(record.quantity ?? record.qty),
        unitPrice: normalizeNumber(record.unitPrice ?? record.unit_price ?? record.price),
        total: normalizeNumber(record.total ?? record.lineTotal ?? record.line_total),
    };
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
    if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = parseFloat(value.replace(/[^0-9.\-]/g, ''));
        return Number.isNaN(normalized) ? null : normalized;
    }
    return null;
}

function normalizeDate(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    try {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

function normalizeConfidence(value: unknown): number | null {
    const normalized = normalizeNumber(value);
    if (normalized === null) return null;
    const bounded = normalized > 1 ? normalized / 100 : normalized;
    return Math.min(Math.max(bounded, 0), 1);
}

function logUsage(options: {
    provider: LLMProvider;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    requestId?: string;
    userId?: string;
}) {
    const inputTokens = options.inputTokens || 0;
    const outputTokens = options.outputTokens || 0;
    const cost = estimateCost(options.model, inputTokens, outputTokens);

    logger.info('Receipt LLM usage', {
        provider: options.provider,
        model: options.model,
        inputTokens,
        outputTokens,
        estimatedCostUsd: cost,
        requestId: options.requestId,
        userId: options.userId,
    });

    const budgetRaw = process.env.RECEIPT_LLM_MAX_COST_USD;
    if (budgetRaw && cost !== null) {
        const budget = parseFloat(budgetRaw);
        if (!Number.isNaN(budget) && cost > budget) {
            logger.warn('Receipt LLM cost exceeded budget', {
                provider: options.provider,
                model: options.model,
                estimatedCostUsd: cost,
                budgetUsd: budget,
                requestId: options.requestId,
                userId: options.userId,
            });
        }
    }
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null {
    const overrideInput = parseFloat(process.env.RECEIPT_LLM_INPUT_COST_PER_MILLION || '');
    const overrideOutput = parseFloat(process.env.RECEIPT_LLM_OUTPUT_COST_PER_MILLION || '');

    const pricing = !Number.isNaN(overrideInput) && !Number.isNaN(overrideOutput)
        ? { input: overrideInput, output: overrideOutput }
        : MODEL_PRICING_PER_MILLION[model];

    if (!pricing) {
        return null;
    }

    const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
    return Number(cost.toFixed(6));
}
