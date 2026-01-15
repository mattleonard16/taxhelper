import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { summaryQuerySchema } from "@/lib/schemas";
import { Prisma } from "@prisma/client";
import { parseDateInput } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { formatInTimeZone } from "date-fns-tz";

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

    const parseResult = summaryQuerySchema.safeParse(params);
    if (!parseResult.success) {
      return attachRequestId(ApiErrors.validation(
        parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      ), requestId);
    }

    const { from, to } = parseResult.data;
    const fromDate = from
      ? parseDateInput(from, "start")
      : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? parseDateInput(to, "end") : new Date();

    // Fetch user's timezone for "today" calculation
    const userPrefs = await prisma.user.findUnique({
      where: { id: user.id },
      select: { timezone: true },
    });
    const userTimezone = userPrefs?.timezone || "America/Los_Angeles";

    const where = {
      userId: user.id,
      date: {
        gte: fromDate,
        lte: toDate,
      },
    };

    // Use Prisma aggregations for better performance
    // All aggregations are done at the database level
    const [aggregations, byTypeRaw, merchantAggregations, dailyAggregations] = await Promise.all([
      // Get totals using database aggregation
      prisma.transaction.aggregate({
        where,
        _sum: {
          taxAmount: true,
          totalAmount: true,
        },
        _count: true,
      }),
      // Group by type
      prisma.transaction.groupBy({
        by: ['type'],
        where,
        _sum: {
          taxAmount: true,
          totalAmount: true,
        },
      }),
      // Group by merchant for top merchants (database-level aggregation)
      prisma.transaction.groupBy({
        by: ['merchant'],
        where: {
          ...where,
          merchant: { not: null },
        },
        _sum: {
          taxAmount: true,
        },
        orderBy: {
          _sum: {
            taxAmount: 'desc',
          },
        },
        take: 5,
      }),
      // Get daily aggregations using raw SQL for efficiency
      // This avoids fetching all transactions into memory
      prisma.$queryRaw<Array<{ date_key: Date; total_tax: Prisma.Decimal }>>`
        SELECT 
          DATE("date") as date_key,
          SUM("taxAmount") as total_tax
        FROM "Transaction"
        WHERE "userId" = ${user.id}
          AND "date" >= ${fromDate}
          AND "date" <= ${toDate}
        GROUP BY DATE("date")
        ORDER BY date_key ASC
      `,
    ]);

    // Process results
    const totalTax = aggregations._sum.taxAmount || new Prisma.Decimal(0);
    const totalSpent = aggregations._sum.totalAmount || new Prisma.Decimal(0);
    const transactionCount = aggregations._count;

    // Build byType map
    const byType: Record<string, Prisma.Decimal> = {
      SALES_TAX: new Prisma.Decimal(0),
      INCOME_TAX: new Prisma.Decimal(0),
      OTHER: new Prisma.Decimal(0),
    };
    const byTypeTotals: Record<string, Prisma.Decimal> = {
      SALES_TAX: new Prisma.Decimal(0),
      INCOME_TAX: new Prisma.Decimal(0),
      OTHER: new Prisma.Decimal(0),
    };
    for (const item of byTypeRaw) {
      byType[item.type] = item._sum.taxAmount || new Prisma.Decimal(0);
      byTypeTotals[item.type] = item._sum.totalAmount || new Prisma.Decimal(0);
    }

    // Process merchant aggregations (already sorted and limited by database)
    const topMerchants = merchantAggregations
      .filter((m) => m.merchant !== null)
      .map((m) => ({
        merchant: m.merchant as string,
        tax: (m._sum.taxAmount || new Prisma.Decimal(0)).toString(),
      }));

    // Build daily tax map from database aggregation
    const dailyTax: Record<string, Prisma.Decimal> = {};
    for (const row of dailyAggregations) {
      const dateKey =
        typeof row.date_key === "string"
          ? row.date_key
          : row.date_key.toISOString().split("T")[0];
      dailyTax[dateKey] = row.total_tax || new Prisma.Decimal(0);
    }

    // Build timeseries (already sorted by database)
    const timeseries = Object.entries(dailyTax)
      .map(([date, tax]) => ({ date, tax: tax.toString() }));

    // Calculate tax share
    const taxShare = totalSpent.isZero()
      ? 0
      : totalTax.div(totalSpent).toNumber();

    // Calculate today's tax using user's timezone
    // formatInTimeZone gives us the current date in the user's timezone
    const today = formatInTimeZone(new Date(), userTimezone, "yyyy-MM-dd");
    const todayTax = dailyTax[today] || new Prisma.Decimal(0);

    // Calculate average daily tax across days with activity
    const daysTracked = Object.keys(dailyTax).length;
    const avgDailyTax = daysTracked > 0
      ? totalTax.div(daysTracked)
      : new Prisma.Decimal(0);

    const response = NextResponse.json({
      totalTax: totalTax.toString(),
      totalSpent: totalSpent.toString(),
      taxShare: Math.round(taxShare * 10000) / 10000,
      todayTax: todayTax.toString(),
      avgDailyTax: avgDailyTax.toDecimalPlaces(2).toString(),
      daysTracked,
      byType: {
        SALES_TAX: byType.SALES_TAX.toString(),
        INCOME_TAX: byType.INCOME_TAX.toString(),
        OTHER: byType.OTHER.toString(),
      },
      byTypeTotals: {
        SALES_TAX: byTypeTotals.SALES_TAX.toString(),
        INCOME_TAX: byTypeTotals.INCOME_TAX.toString(),
        OTHER: byTypeTotals.OTHER.toString(),
      },
      timeseries,
      topMerchants,
      transactionCount,
    });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error fetching summary", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
