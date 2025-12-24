import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export interface OnboardingStatus {
  hasTransaction: boolean;
  hasReceipt: boolean;
  hasTaxRate: boolean;
  hasInsight: boolean;
  allComplete: boolean;
  sampleDataLoaded: boolean;
}

/**
 * GET /api/onboarding
 * Returns the onboarding completion status for the current user
 */
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

    // Check all onboarding conditions in parallel
    const [
      transactionCount,
      receiptCount,
      userData,
      insightCount,
      sampleDataCount,
    ] = await Promise.all([
      // Has at least 1 transaction
      prisma.transaction.count({
        where: { userId: user.id },
        take: 1,
      }),
      // Has at least 1 receipt (transaction with receiptPath)
      prisma.transaction.count({
        where: {
          userId: user.id,
          receiptPath: { not: null },
        },
        take: 1,
      }),
      // Get user settings for tax rate
      prisma.user.findUnique({
        where: { id: user.id },
        select: { defaultTaxRate: true },
      }),
      // Has at least 1 insight from a recent run
      prisma.insightRun.count({
        where: {
          userId: user.id,
          insights: { some: {} },
        },
        take: 1,
      }),
      // Check if sample data has been loaded (transactions with [DEMO] prefix)
      prisma.transaction.count({
        where: {
          userId: user.id,
          description: { startsWith: "[DEMO]" },
        },
        take: 1,
      }),
    ]);

    const hasTransaction = transactionCount > 0;
    const hasReceipt = receiptCount > 0;
    const hasTaxRate = userData?.defaultTaxRate !== null;
    const hasInsight = insightCount > 0;
    const sampleDataLoaded = sampleDataCount > 0;
    const allComplete = hasTransaction && hasReceipt && hasTaxRate && hasInsight;

    const status: OnboardingStatus = {
      hasTransaction,
      hasReceipt,
      hasTaxRate,
      hasInsight,
      allComplete,
      sampleDataLoaded,
    };

    const response = NextResponse.json(status);

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error fetching onboarding status", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
