/**
 * Receipt Job Retry API Endpoint
 * POST /api/receipts/jobs/[id]/retry - Retry a failed receipt job
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { retryJob } from "@/lib/receipt/receipt-jobs-service";
import { logger } from "@/lib/logger";

export async function POST(
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

    const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.mutation);
    if (!rateLimitResult.success) {
      return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
    }

    const { id } = await params;
    const result = await retryJob(user.id, id);

    if (!result.success) {
      const status = result.code === "NOT_FOUND" ? 404 : 400;
      return attachRequestId(
        NextResponse.json({ error: result.error, code: result.code }, { status }),
        requestId
      );
    }

    const job = result.data;
    const response = NextResponse.json({
      retried: true,
      id: job.id,
      status: job.status,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    logger.info("Receipt job retried", {
      requestId,
      userId,
      jobId: id,
    });

    return response;
  } catch (error) {
    logger.error("Error retrying receipt job", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
