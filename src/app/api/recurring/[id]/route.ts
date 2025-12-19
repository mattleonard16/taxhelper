import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, parseRequestBody, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { TransactionTypeSchema } from "@/lib/schemas";

const updateRecurringSchema = z.object({
    label: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    merchant: z.string().max(100).optional(),
    amount: z.number().positive().optional(),
    taxRate: z.number().min(0).max(1).optional(),
    type: TransactionTypeSchema.optional(),
    currency: z.string().length(3).optional(),
    frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
    dayOfMonth: z.number().min(1).max(28).optional(),
    nextRunDate: z.string().optional(),
    isActive: z.boolean().optional(),
});

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - Get a single recurring transaction
export async function GET(request: NextRequest, { params }: RouteParams) {
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

        const { id } = await params;
        const recurring = await prisma.recurringTransaction.findUnique({
            where: { id, userId: user.id },
        });

        if (!recurring) {
            return attachRequestId(ApiErrors.notFound("Recurring transaction"), requestId);
        }

        const response = NextResponse.json({
            ...recurring,
            amount: recurring.amount.toString(),
            taxRate: recurring.taxRate.toString(),
        });

        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        response.headers.set("X-Request-Id", requestId);
        return response;
    } catch (error) {
        logger.error("Error fetching recurring transaction", {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}

// PUT - Update a recurring transaction
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

        const { id } = await params;

        // Verify ownership
        const existing = await prisma.recurringTransaction.findUnique({
            where: { id },
            select: { userId: true },
        });

        if (!existing) {
            return attachRequestId(ApiErrors.notFound("Recurring transaction"), requestId);
        }

        if (existing.userId !== user.id) {
            return attachRequestId(ApiErrors.forbidden(), requestId);
        }

        const bodyResult = await parseRequestBody(request, updateRecurringSchema);
        if (!bodyResult.success) {
            return attachRequestId(bodyResult.error, requestId);
        }

        const data = bodyResult.data;

        const updated = await prisma.recurringTransaction.update({
            where: { id },
            data: {
                ...(data.label !== undefined && { label: data.label }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.merchant !== undefined && { merchant: data.merchant }),
                ...(data.amount !== undefined && { amount: data.amount }),
                ...(data.taxRate !== undefined && { taxRate: data.taxRate }),
                ...(data.type !== undefined && { type: data.type }),
                ...(data.currency !== undefined && { currency: data.currency }),
                ...(data.frequency !== undefined && { frequency: data.frequency }),
                ...(data.dayOfMonth !== undefined && { dayOfMonth: data.dayOfMonth }),
                ...(data.nextRunDate !== undefined && { nextRunDate: new Date(data.nextRunDate) }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            },
        });

        const response = NextResponse.json({
            ...updated,
            amount: updated.amount.toString(),
            taxRate: updated.taxRate.toString(),
        });

        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        response.headers.set("X-Request-Id", requestId);
        return response;
    } catch (error) {
        logger.error("Error updating recurring transaction", {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}

// DELETE - Delete a recurring transaction
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

        const { id } = await params;

        // Verify ownership
        const existing = await prisma.recurringTransaction.findUnique({
            where: { id },
            select: { userId: true },
        });

        if (!existing) {
            return attachRequestId(ApiErrors.notFound("Recurring transaction"), requestId);
        }

        if (existing.userId !== user.id) {
            return attachRequestId(ApiErrors.forbidden(), requestId);
        }

        await prisma.recurringTransaction.delete({
            where: { id },
        });

        const response = new NextResponse(null, { status: 204 });
        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        response.headers.set("X-Request-Id", requestId);
        return response;
    } catch (error) {
        logger.error("Error deleting recurring transaction", {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}
