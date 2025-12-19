import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, parseRequestBody, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { updateTemplateSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";

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

    const existing = await prisma.taxTemplate.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return attachRequestId(ApiErrors.notFound("Template"), requestId);
    }

    const bodyResult = await parseRequestBody(request, updateTemplateSchema);
    if (!bodyResult.success) {
      return attachRequestId(bodyResult.error, requestId);
    }

    const { label, merchant, taxRate, type, isDefault } = bodyResult.data;

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.taxTemplate.updateMany({
        where: { userId: user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const template = await prisma.taxTemplate.update({
      where: { id },
      data: {
        ...(label && { label }),
        ...(merchant !== undefined && { merchant }),
        ...(taxRate !== undefined && { taxRate }),
        ...(type && { type }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    const response = NextResponse.json({
      ...template,
      taxRate: template.taxRate.toString(),
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error updating template", {
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

    const existing = await prisma.taxTemplate.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return attachRequestId(ApiErrors.notFound("Template"), requestId);
    }

    await prisma.taxTemplate.delete({ where: { id } });

    const response = NextResponse.json({ success: true });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error deleting template", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
