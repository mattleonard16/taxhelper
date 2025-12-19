import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, parseRequestBody, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { TransactionTypeSchema } from "@/lib/schemas";

const createRecurringSchema = z.object({
    label: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    merchant: z.string().max(100).optional(),
    amount: z.number().positive(),
    taxRate: z.number().min(0).max(1),
    type: TransactionTypeSchema,
    currency: z.string().length(3).optional(),
    frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
    dayOfMonth: z.number().min(1).max(28).optional(),
    nextRunDate: z.string(), // ISO date string
    isActive: z.boolean().optional(),
});

// GET - List all recurring transactions for user
export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    let userId: string | undefined;

    try {
        const user = await getAuthUser();
        if (!user) {
            return attachRequestId(ApiErrors.unauthorized(), requestId);
        }
        userId = user.id;

        const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.api);
        if (!rateLimitResult.success) {
            return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
        }

        const recurring = await prisma.recurringTransaction.findMany({
            where: { userId: user.id },
            orderBy: { nextRunDate: "asc" },
        });

        const response = NextResponse.json({
            recurring: recurring.map((r) => ({
                ...r,
                amount: r.amount.toString(),
                taxRate: r.taxRate.toString(),
            })),
        });

        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        response.headers.set("X-Request-Id", requestId);
        return response;
    } catch (error) {
        logger.error("Error fetching recurring transactions", {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}

// POST - Create a new recurring transaction
export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    let userId: string | undefined;

    try {
        const user = await getAuthUser();
        if (!user) {
            return attachRequestId(ApiErrors.unauthorized(), requestId);
        }
        userId = user.id;

        const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.mutation);
        if (!rateLimitResult.success) {
            return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
        }

        const bodyResult = await parseRequestBody(request, createRecurringSchema);
        if (!bodyResult.success) {
            return attachRequestId(bodyResult.error, requestId);
        }

        const {
            label,
            description,
            merchant,
            amount,
            taxRate,
            type,
            currency,
            frequency,
            dayOfMonth,
            nextRunDate,
            isActive,
        } = bodyResult.data;

        const recurring = await prisma.recurringTransaction.create({
            data: {
                userId: user.id,
                label,
                description,
                merchant,
                amount,
                taxRate,
                type,
                currency: currency || "USD",
                frequency,
                dayOfMonth,
                nextRunDate: new Date(nextRunDate),
                isActive: isActive ?? true,
            },
        });

        const response = NextResponse.json(
            {
                ...recurring,
                amount: recurring.amount.toString(),
                taxRate: recurring.taxRate.toString(),
            },
            { status: 201 }
        );

        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        response.headers.set("X-Request-Id", requestId);
        return response;
    } catch (error) {
        logger.error("Error creating recurring transaction", {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}
