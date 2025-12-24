/**
 * Receipt Jobs API Endpoint
 * GET /api/receipts/jobs - List user's receipt jobs
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { createReceiptJobRepository } from "@/lib/receipt/receipt-job-repository";
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

    const repository = createReceiptJobRepository();
    const jobs = await repository.findByUser(user.id);

    const response = NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        originalName: job.originalName,
        mimeType: job.mimeType,
        fileSize: job.fileSize,
        merchant: job.merchant,
        date: job.date?.toISOString() ?? null,
        totalAmount: job.totalAmount,
        taxAmount: job.taxAmount,
        currency: job.currency,
        transactionId: job.transactionId,
        attempts: job.attempts,
        lastError: job.lastError,
        processedAt: job.processedAt?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
      })),
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error fetching receipt jobs", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
