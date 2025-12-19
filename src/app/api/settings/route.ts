import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, parseRequestBody, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";

const updateSettingsSchema = z.object({
  country: z.string().max(100).nullish(),
  state: z.string().max(100).nullish(),
  defaultTaxRate: z.number().min(0).max(1).nullish(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(50).optional(),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  let userId: string | undefined;

  try {
    const user = await getAuthUser();
    if (!user) {
      return attachRequestId(ApiErrors.unauthorized(), requestId);
    }
    userId = user.id;

    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.api);
    if (!rateLimitResult.success) {
      return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        country: true,
        state: true,
        defaultTaxRate: true,
        currency: true,
        timezone: true,
        name: true,
        email: true,
      },
    });

    if (!userData) {
      return attachRequestId(ApiErrors.notFound("User"), requestId);
    }

    const response = NextResponse.json({
      ...userData,
      defaultTaxRate: userData.defaultTaxRate?.toString() || null,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error fetching settings", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}

export async function PUT(request: NextRequest) {
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

    const bodyResult = await parseRequestBody(request, updateSettingsSchema);
    if (!bodyResult.success) {
      return attachRequestId(bodyResult.error, requestId);
    }

    const { country, state, defaultTaxRate, currency, timezone } = bodyResult.data;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(country !== undefined && { country: country || null }),
        ...(state !== undefined && { state: state || null }),
        ...(defaultTaxRate !== undefined && { defaultTaxRate: defaultTaxRate }),
        ...(currency !== undefined && { currency }),
        ...(timezone !== undefined && { timezone }),
      },
      select: {
        country: true,
        state: true,
        defaultTaxRate: true,
        currency: true,
        timezone: true,
        name: true,
        email: true,
      },
    });

    const response = NextResponse.json({
      ...updatedUser,
      defaultTaxRate: updatedUser.defaultTaxRate?.toString() || null,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error updating settings", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
