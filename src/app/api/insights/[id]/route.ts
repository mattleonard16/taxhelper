import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, ApiErrors, parseRequestBody, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { insightStateSchema } from "@/lib/schemas";
import { createInsightRepository } from "@/lib/insights/insight-repository";
import { logger } from "@/lib/logger";

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
    const bodyResult = await parseRequestBody(request, insightStateSchema);
    if (!bodyResult.success) {
      return attachRequestId(bodyResult.error, requestId);
    }

    const updates = {
      dismissed: bodyResult.data.dismissed,
      pinned: bodyResult.data.pinned,
    };

    if (updates.dismissed === true) {
      updates.pinned = false;
    }
    if (updates.pinned === true) {
      updates.dismissed = false;
    }

    const insightRepository = createInsightRepository();
    const updated = await insightRepository.updateInsightState(user.id, id, updates);
    if (!updated) {
      return attachRequestId(ApiErrors.notFound("Insight"), requestId);
    }

    const response = NextResponse.json({ insight: updated });
    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error updating insight", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
