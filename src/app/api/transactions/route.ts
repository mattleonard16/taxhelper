import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, parseRequestBody, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { createTransactionSchema, transactionQuerySchema } from "@/lib/schemas";
import { parseDateInput } from "@/lib/date-utils";
import { buildTransactionSearchWhere } from "@/lib/transactions/transaction-search";
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

    const parseResult = transactionQuerySchema.safeParse(params);
    if (!parseResult.success) {
      return attachRequestId(ApiErrors.validation(
        parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      ), requestId);
    }

    const { ids, from, to, type, search, minAmount, maxAmount, category, isDeductible, page, limit } = parseResult.data;

    // Fetch by explicit IDs (used by Insights drill-down)
    if (ids && ids.length > 0) {
      const uniqueIds = Array.from(new Set(ids));

      const transactions = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          id: { in: uniqueIds },
        },
        orderBy: { date: "desc" },
      });

      const total = transactions.length;
      const pages = Math.ceil(total / uniqueIds.length);

      const response = NextResponse.json({
        transactions: transactions.map((t) => ({
          ...t,
          totalAmount: t.totalAmount.toString(),
          taxAmount: t.taxAmount.toString(),
        })),
        pagination: {
          page: 1,
          limit: uniqueIds.length,
          total,
          pages,
        },
      });

      // Add rate limit headers
      rateLimitResult.headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
      response.headers.set("X-Request-Id", requestId);

      return response;
    }

    const skip = (page - 1) * limit;

    const where = buildTransactionSearchWhere(user.id, {
      from,
      to,
      type,
      search,
      minAmount,
      maxAmount,
      category,
      isDeductible,
    });

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const response = NextResponse.json({
      transactions: transactions.map((t) => ({
        ...t,
        totalAmount: t.totalAmount.toString(),
        taxAmount: t.taxAmount.toString(),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

    // Add rate limit headers
    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error fetching transactions", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}

export async function POST(request: NextRequest) {
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

    const bodyResult = await parseRequestBody(request, createTransactionSchema);
    if (!bodyResult.success) {
      return attachRequestId(bodyResult.error, requestId);
    }

    const { date, type, description, merchant, totalAmount, taxAmount, currency, receiptPath, receiptName } = bodyResult.data;

    const transactionData: Record<string, unknown> = {
      userId: user.id,
      date: parseDateInput(date, "midday"),
      type,
      description: description || null,
      merchant: merchant || null,
      totalAmount,
      taxAmount,
      currency: currency || "USD",
    };

    // Add receipt fields if the schema has been migrated
    if (receiptPath) transactionData.receiptPath = receiptPath;
    if (receiptName) transactionData.receiptName = receiptName;

    const transaction = await prisma.transaction.create({
      data: transactionData as Parameters<typeof prisma.transaction.create>[0]['data'],
    });

    const response = NextResponse.json({
      ...transaction,
      totalAmount: transaction.totalAmount.toString(),
      taxAmount: transaction.taxAmount.toString(),
    }, { status: 201 });

    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error creating transaction", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
