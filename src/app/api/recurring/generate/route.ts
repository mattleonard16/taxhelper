import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { addWeeks, addMonths } from "date-fns";

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

        const now = new Date();

        const dueRecurring = await prisma.recurringTransaction.findMany({
            where: {
                userId: user.id,
                isActive: true,
                nextRunDate: { lte: now },
            },
        });

        const generatedTransactions = [];

        for (const recurring of dueRecurring) {
            const total = parseFloat(recurring.amount.toString());
            const rate = parseFloat(recurring.taxRate.toString());
            const preTax = total / (1 + rate);
            const taxAmount = preTax * rate;

            const transaction = await prisma.transaction.create({
                data: {
                    userId: user.id,
                    date: recurring.nextRunDate,
                    type: recurring.type,
                    description: recurring.description || `${recurring.label} (recurring)`,
                    merchant: recurring.merchant,
                    totalAmount: recurring.amount,
                    taxAmount: taxAmount,
                    currency: recurring.currency,
                },
            });

            generatedTransactions.push(transaction);

            let nextRunDate: Date;
            switch (recurring.frequency) {
                case "WEEKLY":
                    nextRunDate = addWeeks(recurring.nextRunDate, 1);
                    break;
                case "BIWEEKLY":
                    nextRunDate = addWeeks(recurring.nextRunDate, 2);
                    break;
                case "MONTHLY":
                    nextRunDate = addMonths(recurring.nextRunDate, 1);
                    if (recurring.dayOfMonth) {
                        nextRunDate.setDate(Math.min(recurring.dayOfMonth, 28));
                    }
                    break;
            }

            await prisma.recurringTransaction.update({
                where: { id: recurring.id },
                data: {
                    nextRunDate,
                    lastRunDate: now,
                },
            });
        }

        const response = NextResponse.json({
            generated: generatedTransactions.length,
            transactions: generatedTransactions.map((t) => ({
                id: t.id,
                date: t.date,
                type: t.type,
                merchant: t.merchant,
                totalAmount: t.totalAmount.toString(),
                taxAmount: t.taxAmount.toString(),
            })),
        });

        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        response.headers.set("X-Request-Id", requestId);
        return response;
    } catch (error) {
        logger.error("Error generating recurring transactions", {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}
