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

        // Get receipt job stats, category breakdown, and tax stats
        const [receiptStats, categoryStats, deductibleStats, taxStats, avgConfidence] = await Promise.all([
            prisma.receiptJob.groupBy({
                by: ["status"],
                where: { userId, discardedAt: null },
                _count: { id: true },
            }),
            prisma.receiptJob.groupBy({
                by: ["category", "categoryCode"],
                where: { 
                    userId, 
                    status: "COMPLETED",
                    category: { not: null },
                    discardedAt: null,
                },
                _sum: { totalAmount: true },
                _count: { id: true },
            }),
            prisma.receiptJob.aggregate({
                where: { 
                    userId, 
                    status: "COMPLETED",
                    isDeductible: true,
                    discardedAt: null,
                },
                _sum: { totalAmount: true },
                _count: { id: true },
            }),
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
            prisma.receiptJob.aggregate({
                where: { 
                    userId, 
                    status: "COMPLETED",
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

        // Format category breakdown
        const categories = categoryStats
            .filter(cat => cat.category && cat.categoryCode)
            .map(cat => ({
                category: cat.category!,
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
