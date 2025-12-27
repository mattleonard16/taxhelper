/**
 * Receipt Inbox API Endpoint
 * GET /api/receipts/inbox - List receipt jobs pending review/confirmation
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { listInbox, type InboxFilters } from "@/lib/receipt/receipt-jobs-service";
import { logger } from "@/lib/logger";
import type { ReceiptJobStatus } from "@prisma/client";

const VALID_STATUSES: ReceiptJobStatus[] = ["NEEDS_REVIEW", "COMPLETED", "FAILED", "CONFIRMED"];

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

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const cursor = searchParams.get("cursor") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const filters: InboxFilters = { cursor, limit };

    if (statusParam) {
      const statuses = statusParam.split(",") as ReceiptJobStatus[];
      const invalidStatus = statuses.find((s) => !VALID_STATUSES.includes(s));
      if (invalidStatus) {
        return attachRequestId(
          ApiErrors.validation(`Invalid status: ${invalidStatus}`),
          requestId
        );
      }
      filters.status = statuses;
    }

    const result = await listInbox(user.id, filters);

    if (!result.success) {
      return attachRequestId(
        NextResponse.json({ error: result.error }, { status: 400 }),
        requestId
      );
    }

    const response = NextResponse.json({
      jobs: result.data.jobs.map((job) => ({
        id: job.id,
        status: job.status,
        originalName: job.originalName,
        mimeType: job.mimeType,
        fileSize: job.fileSize,
        merchant: job.merchant,
        date: job.date?.toISOString() ?? null,
        totalAmount: job.totalAmount,
        taxAmount: job.taxAmount,
        category: job.category,
        categoryCode: job.categoryCode,
        isDeductible: job.isDeductible,
        extractionConfidence: job.extractionConfidence,
        transactionId: job.transactionId,
        lastError: job.lastError,
        createdAt: job.createdAt.toISOString(),
      })),
      nextCursor: result.data.nextCursor,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error fetching receipt inbox", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
