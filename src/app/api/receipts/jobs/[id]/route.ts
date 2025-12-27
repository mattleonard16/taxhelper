/**
 * Receipt Job API Endpoint
 * GET /api/receipts/jobs/[id] - Get status of a specific receipt job
 * PATCH /api/receipts/jobs/[id] - Update extracted fields
 * DELETE /api/receipts/jobs/[id] - Discard a receipt job
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { createReceiptJobRepository } from "@/lib/receipt/receipt-job-repository";
import { patchJob, discardJob, type PatchJobInput } from "@/lib/receipt/receipt-jobs-service";
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

export async function PATCH(
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
    const body = await request.json();

    const patch: PatchJobInput = {};
    if (body.merchant !== undefined) patch.merchant = body.merchant;
    if (body.date !== undefined) patch.date = body.date;
    if (body.totalAmount !== undefined) {
      const totalAmount = Number(body.totalAmount);
      if (Number.isNaN(totalAmount) || totalAmount < 0) {
        return attachRequestId(
          NextResponse.json({ error: "Invalid totalAmount" }, { status: 400 }),
          requestId
        );
      }
      patch.totalAmount = totalAmount;
    }
    if (body.taxAmount !== undefined) {
      const taxAmount = Number(body.taxAmount);
      if (Number.isNaN(taxAmount) || taxAmount < 0) {
        return attachRequestId(
          NextResponse.json({ error: "Invalid taxAmount" }, { status: 400 }),
          requestId
        );
      }
      patch.taxAmount = taxAmount;
    }
    if (body.category !== undefined) patch.category = body.category;
    if (body.categoryCode !== undefined) patch.categoryCode = body.categoryCode;
    if (body.isDeductible !== undefined) patch.isDeductible = Boolean(body.isDeductible);

    const result = await patchJob(user.id, id, patch);

    if (!result.success) {
      const status = result.code === "NOT_FOUND" ? 404 : 400;
      return attachRequestId(
        NextResponse.json({ error: result.error, code: result.code }, { status }),
        requestId
      );
    }

    const job = result.data;
    const response = NextResponse.json({
      id: job.id,
      status: job.status,
      merchant: job.merchant,
      date: job.date?.toISOString() ?? null,
      totalAmount: job.totalAmount,
      taxAmount: job.taxAmount,
      category: job.category,
      categoryCode: job.categoryCode,
      isDeductible: job.isDeductible,
      updatedAt: job.updatedAt.toISOString(),
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error updating receipt job", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}

export async function DELETE(
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
    const result = await discardJob(user.id, id);

    if (!result.success) {
      const status = result.code === "NOT_FOUND" ? 404 : 400;
      return attachRequestId(
        NextResponse.json({ error: result.error, code: result.code }, { status }),
        requestId
      );
    }

    const response = NextResponse.json({ deleted: true }, { status: 200 });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error deleting receipt job", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
