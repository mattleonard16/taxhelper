import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

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

        const startOfYear = new Date(new Date().getFullYear(), 0, 1);

        // Get receipt job stats (pipeline only), category/deductible from transactions (source of truth)
        const [receiptStats, categoryStats, deductibleStats, taxStats, avgConfidence] = await Promise.all([
            // Receipt pipeline stats (still from ReceiptJob)
            prisma.receiptJob.groupBy({
                by: ["status"],
                where: { userId, discardedAt: null },
                _count: { id: true },
            }),
            // Category breakdown from confirmed transactions (source of truth)
            prisma.transaction.groupBy({
                by: ["category", "categoryCode"],
                where: { 
                    userId, 
                    date: { gte: startOfYear },
                    categoryCode: { not: null },
                },
                _sum: { totalAmount: true },
                _count: { id: true },
            }),
            // Deductible stats from confirmed transactions (source of truth)
            prisma.transaction.aggregate({
                where: { 
                    userId, 
                    date: { gte: startOfYear },
                    isDeductible: true,
                },
                _sum: { totalAmount: true },
                _count: { id: true },
            }),
            // Tax stats from transactions
            prisma.transaction.aggregate({
                where: {
                    userId,
                    date: { gte: startOfYear },
                },
                _sum: {
                    taxAmount: true,
                    totalAmount: true,
                },
                _count: { id: true },
            }),
            // Average confidence still from receipts (pipeline metric)
            prisma.receiptJob.aggregate({
                where: { 
                    userId, 
                    status: "CONFIRMED",
                    extractionConfidence: { not: null },
                    discardedAt: null,
                },
                _avg: { extractionConfidence: true },
            }),
        ]);

        // Calculate receipt job counts
        const jobCounts = {
            queued: 0,
            processing: 0,
            completed: 0,
            failed: 0,
        };
        receiptStats.forEach((stat) => {
            const status = stat.status.toLowerCase() as keyof typeof jobCounts;
            if (status in jobCounts) {
                jobCounts[status] = stat._count.id;
            }
        });

        const totalJobs = Object.values(jobCounts).reduce((a, b) => a + b, 0);
        const totalSpent = taxStats._sum.totalAmount?.toNumber() || 0;
        const totalTax = taxStats._sum.taxAmount?.toNumber() || 0;
        const deductibleTotal = deductibleStats._sum.totalAmount?.toNumber() || 0;
        const deductibleCount = deductibleStats._count.id || 0;

        // Format category breakdown from transactions
        const categories = categoryStats
            .filter(cat => cat.categoryCode)
            .map(cat => ({
                category: cat.category || cat.categoryCode!,
                categoryCode: cat.categoryCode!,
                amount: cat._sum.totalAmount?.toNumber() || 0,
                count: cat._count.id,
            }))
            .sort((a, b) => b.amount - a.amount);

        const response = NextResponse.json({
            receipts: {
                total: totalJobs,
                processed: jobCounts.completed,
                pending: jobCounts.queued + jobCounts.processing,
                failed: jobCounts.failed,
            },
            tax: {
                totalPaid: totalTax.toFixed(2),
                totalSpent: totalSpent.toFixed(2),
                transactionCount: taxStats._count.id,
            },
            deductions: {
                total: deductibleTotal.toFixed(2),
                count: deductibleCount,
            },
            categories,
            avgConfidence: avgConfidence._avg.extractionConfidence ?? null,
        });

        rateLimitResult.headers.forEach((value, key) => {
            response.headers.set(key, value);
        });
        response.headers.set("X-Request-Id", requestId);

        return response;
    } catch (error) {
        logger.error("Error fetching receipt stats", {
            requestId,
            userId,
            path: request.nextUrl.pathname,
            method: request.method,
            error,
        });
        return attachRequestId(ApiErrors.internal(), requestId);
    }
}
