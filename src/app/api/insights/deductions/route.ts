import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { insightsQuerySchema } from "@/lib/schemas";
import { createTransactionRepository } from "@/lib/insights/transaction-repository";
import { buildDeductionSummary } from "@/lib/deductions";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

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
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const parseResult = insightsQuerySchema.safeParse(params);
    if (!parseResult.success) {
      return attachRequestId(
        ApiErrors.validation(
          parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        ),
        requestId
      );
    }

    const { range } = parseResult.data;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - range);

    const transactionRepository = createTransactionRepository();
    const transactions = await transactionRepository.listByUserSince(user.id, fromDate);

    const userPreferences = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        isFreelancer: true,
        worksFromHome: true,
        hasHealthInsurance: true,
        defaultTaxRate: true,
      },
    });

    // Use user's tax rate if set (including 0%), otherwise will fall back to 25% default
    // Use null check instead of truthiness to handle 0% correctly
    const userTaxRate = userPreferences?.defaultTaxRate !== null && userPreferences?.defaultTaxRate !== undefined
      ? Number(userPreferences.defaultTaxRate)
      : undefined;

    const summary = buildDeductionSummary(transactions, {
      isFreelancer: userPreferences?.isFreelancer ?? undefined,
      worksFromHome: userPreferences?.worksFromHome ?? undefined,
      hasHealthInsurance: userPreferences?.hasHealthInsurance ?? undefined,
      estimatedTaxRate: userTaxRate,
    });

    // Determine the effective tax rate used for calculation display
    const effectiveTaxRate = userTaxRate !== undefined ? userTaxRate : 0.25;

    const response = NextResponse.json({
      deductions: summary.deductions.map((deduction) => ({
        category: deduction.category,
        potentialDeduction: deduction.potentialDeduction,
        estimatedSavings: deduction.estimatedSavings,
        transactions: deduction.transactions,
        suggestion: deduction.suggestion,
      })),
      totalPotentialDeduction: summary.totalPotentialDeduction,
      estimatedTaxSavings: summary.estimatedTaxSavings,
      taxRateUsed: effectiveTaxRate,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error fetching deduction insights", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
