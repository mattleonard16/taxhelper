import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from '@/lib/api-utils';
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from '@/lib/rate-limit';
import { insightsQuerySchema } from '@/lib/schemas';
import { getInsights } from '@/lib/insights';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

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

    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const parseResult = insightsQuerySchema.safeParse(params);
    if (!parseResult.success) {
      return attachRequestId(
        ApiErrors.validation(
          parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        ),
        requestId
      );
    }

    const { range } = parseResult.data;
    const refreshParam = searchParams.get('refresh');
    const forceRefresh = refreshParam === '1' || refreshParam === 'true';
    const userPreferences = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        isFreelancer: true,
        worksFromHome: true,
        hasHealthInsurance: true,
      },
    });
    const insights = await getInsights(user.id, range, {
      forceRefresh,
      userContext: {
        isFreelancer: userPreferences?.isFreelancer ?? undefined,
        worksFromHome: userPreferences?.worksFromHome ?? undefined,
        hasHealthInsurance: userPreferences?.hasHealthInsurance ?? undefined,
      },
    });

    const response = NextResponse.json({ insights });
    const cacheControl = forceRefresh
      ? "no-store"
      : "private, max-age=60, stale-while-revalidate=300";
    response.headers.set("Cache-Control", cacheControl);
    response.headers.set("Vary", "Cookie");

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set('X-Request-Id', requestId);

    return response;
  } catch (error) {
    logger.error('Error fetching insights', {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
