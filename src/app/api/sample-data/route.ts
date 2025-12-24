import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { generateSampleTransactions, DEMO_PREFIX } from "@/lib/sample-data";

/**
 * POST /api/sample-data
 * Creates sample demo transactions for new users to explore the app
 * Idempotent: won't create duplicates if sample data already exists
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  let userId: string | undefined;

  try {
    const user = await getAuthUser();
    if (!user) {
      return attachRequestId(ApiErrors.unauthorized(), requestId);
    }
    userId = user.id;

    // Rate limiting for mutations (stricter)
    const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.mutation);
    if (!rateLimitResult.success) {
      return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
    }

    // Check if sample data already exists for this user
    const existingDemoCount = await prisma.transaction.count({
      where: {
        userId: user.id,
        description: { startsWith: DEMO_PREFIX },
      },
    });

    if (existingDemoCount > 0) {
      const response = NextResponse.json({
        success: true,
        message: "Sample data already loaded",
        created: 0,
        alreadyExisted: existingDemoCount,
      });

      rateLimitResult.headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
      response.headers.set("X-Request-Id", requestId);

      return response;
    }

    // Generate and create sample transactions
    const sampleTransactions = generateSampleTransactions();

    const createdTransactions = await prisma.transaction.createMany({
      data: sampleTransactions.map((tx) => ({
        userId: user.id,
        date: tx.date,
        type: tx.type,
        description: tx.description,
        merchant: tx.merchant,
        totalAmount: tx.totalAmount,
        taxAmount: tx.taxAmount,
        currency: "USD",
      })),
    });

    // Trigger insights generation by calling the insights API internally
    // This ensures the user sees insights immediately after loading sample data
    try {
      const { getInsights } = await import("@/lib/insights");
      await getInsights(user.id, 30, { forceRefresh: true });
    } catch (insightError) {
      // Log but don't fail the request if insights generation fails
      logger.warn("Failed to generate insights after sample data load", {
        requestId,
        userId,
        error: insightError,
      });
    }

    const response = NextResponse.json({
      success: true,
      message: "Sample data loaded successfully",
      created: createdTransactions.count,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error loading sample data", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}

/**
 * DELETE /api/sample-data
 * Removes all demo transactions for the current user
 */
export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  let userId: string | undefined;

  try {
    const user = await getAuthUser();
    if (!user) {
      return attachRequestId(ApiErrors.unauthorized(), requestId);
    }
    userId = user.id;

    // Rate limiting for mutations
    const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.mutation);
    if (!rateLimitResult.success) {
      return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
    }

    // Delete all demo transactions for this user
    const deleted = await prisma.transaction.deleteMany({
      where: {
        userId: user.id,
        description: { startsWith: DEMO_PREFIX },
      },
    });

    const response = NextResponse.json({
      success: true,
      message: deleted.count > 0
        ? `Removed ${deleted.count} sample transactions`
        : "No sample data to remove",
      deleted: deleted.count,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error clearing sample data", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}

