/**
 * Batch Transaction Updates API Endpoint
 * PATCH /api/transactions/batch - Update multiple transactions at once
 * DELETE /api/transactions/batch - Delete multiple transactions
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { logger, operationLogger, startTimer } from "@/lib/logger";
import { z } from "zod";

const VALID_CATEGORY_CODES = ["MEALS", "TRAVEL", "OFFICE", "UTILITIES", "SOFTWARE", "PROFESSIONAL", "OTHER"] as const;

// Unique array refinement - reject duplicate IDs
const uniqueIds = z.array(z.string().min(1)).min(1).max(100).refine(
  (ids) => new Set(ids).size === ids.length,
  { message: "Duplicate IDs are not allowed" }
);

const batchUpdateSchema = z.object({
  ids: uniqueIds,
  updates: z.object({
    category: z.string().max(100).optional(),
    categoryCode: z.enum(VALID_CATEGORY_CODES).optional(),
    isDeductible: z.boolean().optional(),
    type: z.enum(["SALES_TAX", "INCOME_TAX", "OTHER"]).optional(),
  }).refine(
    (updates) => Object.keys(updates).length > 0,
    { message: "At least one update field is required" }
  ),
});

const batchDeleteSchema = z.object({
  ids: uniqueIds,
});

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const parseResult = batchUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return attachRequestId(
        ApiErrors.validation(
          parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        ),
        requestId
      );
    }

    const { ids, updates } = parseResult.data;

    // Verify all transactions belong to user
    const existingCount = await prisma.transaction.count({
      where: { id: { in: ids }, userId: user.id },
    });

    if (existingCount !== ids.length) {
      return attachRequestId(
        ApiErrors.validation("One or more transactions not found or unauthorized"),
        requestId
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.categoryCode !== undefined) updateData.categoryCode = updates.categoryCode;
    if (updates.isDeductible !== undefined) updateData.isDeductible = updates.isDeductible;
    if (updates.type !== undefined) updateData.type = updates.type;

    // Perform batch update
    const getElapsed = startTimer();
    const result = await prisma.transaction.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: updateData,
    });

    operationLogger.batchOperation("update", {
      requestId,
      userId,
      count: result.count,
      durationMs: getElapsed(),
    });

    const response = NextResponse.json({
      success: true,
      updatedCount: result.count,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error in batch update", {
      requestId,
      userId,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}

export async function DELETE(request: NextRequest) {
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

    const body = await request.json();
    const parseResult = batchDeleteSchema.safeParse(body);
    if (!parseResult.success) {
      return attachRequestId(
        ApiErrors.validation(
          parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        ),
        requestId
      );
    }

    const { ids } = parseResult.data;

    // Verify all transactions belong to user
    const existingCount = await prisma.transaction.count({
      where: { id: { in: ids }, userId: user.id },
    });

    if (existingCount !== ids.length) {
      return attachRequestId(
        ApiErrors.validation("One or more transactions not found or unauthorized"),
        requestId
      );
    }

    // Perform batch delete
    const getElapsed = startTimer();
    const result = await prisma.transaction.deleteMany({
      where: { id: { in: ids }, userId: user.id },
    });

    operationLogger.batchOperation("delete", {
      requestId,
      userId,
      count: result.count,
      durationMs: getElapsed(),
    });

    const response = NextResponse.json({
      success: true,
      deletedCount: result.count,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error in batch delete", {
      requestId,
      userId,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
