/**
 * Cost tracking for LLM API usage with daily budgets
 */

import type { PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { LLMBudgetExceededError } from './errors';

const MODEL_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-5-sonnet-20240620': { input: 3, output: 15 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4o': { input: 2.5, output: 10 },
};

const DEFAULT_DAILY_BUDGET_USD = parseFloat(process.env.LLM_DAILY_BUDGET_USD || '5.00');

export interface UsageRecord {
    userId: string;
    date: string;
    totalCostUsd: number;
    requestCount: number;
}

export interface CostTracker {
    recordUsage(
        userId: string,
        inputTokens: number,
        outputTokens: number,
        model: string
    ): Promise<void>;
    checkBudget(userId: string): Promise<{ remaining: number; exceeded: boolean; used: number }>;
    getUsage(userId: string): Promise<UsageRecord | null>;
}

function getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
}

function getTodayDate(): Date {
    return new Date(`${getTodayKey()}T00:00:00.000Z`);
}

function toNumber(value: unknown): number {
    if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (value && typeof value === 'object' && 'toNumber' in value) {
        const candidate = value as { toNumber?: () => number };
        if (typeof candidate.toNumber === 'function') {
            return candidate.toNumber();
        }
    }
    return 0;
}

export function calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
): number {
    const pricing = MODEL_PRICING_PER_MILLION[model];
    if (!pricing) {
        logger.warn(`Unknown model pricing: ${model}, using gpt-4o-mini rates`);
        const fallback = MODEL_PRICING_PER_MILLION['gpt-4o-mini'];
        return (inputTokens * fallback.input + outputTokens * fallback.output) / 1_000_000;
    }
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

class PrismaCostTracker implements CostTracker {
    constructor(private client: PrismaClient) {}

    async recordUsage(
        userId: string,
        inputTokens: number,
        outputTokens: number,
        model: string
    ): Promise<void> {
        const cost = calculateCost(model, inputTokens, outputTokens);
        const date = getTodayDate();

        await this.client.llmDailyUsage.upsert({
            where: {
                userId_date: {
                    userId,
                    date,
                },
            },
            create: {
                userId,
                date,
                totalCostUsd: cost,
                requestCount: 1,
            },
            update: {
                totalCostUsd: { increment: cost },
                requestCount: { increment: 1 },
            },
        });

        logger.info('LLM cost recorded', {
            userId,
            model,
            inputTokens,
            outputTokens,
            costUsd: cost,
        });
    }

    async checkBudget(
        userId: string
    ): Promise<{ remaining: number; exceeded: boolean; used: number }> {
        const date = getTodayDate();
        const record = await this.client.llmDailyUsage.findUnique({
            where: {
                userId_date: {
                    userId,
                    date,
                },
            },
        });

        const used = record ? toNumber(record.totalCostUsd) : 0;
        const remaining = Math.max(0, DEFAULT_DAILY_BUDGET_USD - used);
        const exceeded = used >= DEFAULT_DAILY_BUDGET_USD;

        return { remaining, exceeded, used };
    }

    async getUsage(userId: string): Promise<UsageRecord | null> {
        const date = getTodayDate();
        const record = await this.client.llmDailyUsage.findUnique({
            where: {
                userId_date: {
                    userId,
                    date,
                },
            },
        });

        if (!record) {
            return null;
        }

        return {
            userId: record.userId,
            date: record.date.toISOString().split('T')[0],
            totalCostUsd: toNumber(record.totalCostUsd),
            requestCount: record.requestCount,
        };
    }
}

let trackerInstance: CostTracker | null = null;

export function createCostTracker(client: PrismaClient = prisma): CostTracker {
    return new PrismaCostTracker(client);
}

export function getCostTracker(): CostTracker {
    if (!trackerInstance) {
        trackerInstance = createCostTracker(prisma);
    }
    return trackerInstance;
}

export async function checkAndRecordUsage(
    userId: string,
    inputTokens: number,
    outputTokens: number,
    model: string
): Promise<void> {
    const tracker = getCostTracker();
    const budget = await tracker.checkBudget(userId);

    if (budget.exceeded) {
        throw new LLMBudgetExceededError(userId, DEFAULT_DAILY_BUDGET_USD, budget.used);
    }

    await tracker.recordUsage(userId, inputTokens, outputTokens, model);
}

export async function checkBudgetBeforeCall(userId: string): Promise<void> {
    const tracker = getCostTracker();
    const budget = await tracker.checkBudget(userId);

    if (budget.exceeded) {
        throw new LLMBudgetExceededError(userId, DEFAULT_DAILY_BUDGET_USD, budget.used);
    }
}

export function getDailyBudget(): number {
    return DEFAULT_DAILY_BUDGET_USD;
}

export function _resetTrackerForTesting(): void {
    trackerInstance = null;
}
