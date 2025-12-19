import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, parseRequestBody, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { updateTransactionSchema } from "@/lib/schemas";
import { parseDateInput } from "@/lib/date-utils";
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

    const { id } = await params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!transaction) {
      return attachRequestId(ApiErrors.notFound("Transaction"), requestId);
    }

    const response = NextResponse.json({
      ...transaction,
      totalAmount: transaction.totalAmount.toString(),
      taxAmount: transaction.taxAmount.toString(),
    });
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) {
    logger.error("Error fetching transaction", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}

export async function PUT(
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

    // Rate limiting for mutations
    const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.mutation);
    if (!rateLimitResult.success) {
      return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
    }

    const { id } = await params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return attachRequestId(ApiErrors.notFound("Transaction"), requestId);
    }

    const bodyResult = await parseRequestBody(request, updateTransactionSchema);
    if (!bodyResult.success) {
      return attachRequestId(bodyResult.error, requestId);
    }

    const { date, type, description, merchant, totalAmount, taxAmount, currency } = bodyResult.data;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(date && { date: parseDateInput(date, "midday") }),
        ...(type && { type }),
        ...(description !== undefined && { description }),
        ...(merchant !== undefined && { merchant }),
        ...(totalAmount !== undefined && { totalAmount }),
        ...(taxAmount !== undefined && { taxAmount }),
        ...(currency && { currency }),
      },
    });

    const response = NextResponse.json({
      ...transaction,
      totalAmount: transaction.totalAmount.toString(),
      taxAmount: transaction.taxAmount.toString(),
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error updating transaction", {
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

    // Rate limiting for mutations
    const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.mutation);
    if (!rateLimitResult.success) {
      return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
    }

    const { id } = await params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return attachRequestId(ApiErrors.notFound("Transaction"), requestId);
    }

    await prisma.transaction.delete({ where: { id } });

    const response = NextResponse.json({ success: true });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error deleting transaction", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
