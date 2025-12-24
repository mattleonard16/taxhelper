/**
 * Receipt Job Status API Endpoint
 * GET /api/receipts/jobs/[id] - Get status of a specific receipt job
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { createReceiptJobRepository } from "@/lib/receipt/receipt-job-repository";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const repository = createReceiptJobRepository();
    const job = await repository.findById(id, user.id);

    if (!job) {
      return attachRequestId(ApiErrors.notFound("Receipt job"), requestId);
    }

    const response = NextResponse.json({
      id: job.id,
      status: job.status,
      originalName: job.originalName,
      mimeType: job.mimeType,
      fileSize: job.fileSize,
      merchant: job.merchant,
      date: job.date?.toISOString() ?? null,
      totalAmount: job.totalAmount,
      taxAmount: job.taxAmount,
      items: job.items,
      currency: job.currency,
      transactionId: job.transactionId,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      processedAt: job.processedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error fetching receipt job", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
