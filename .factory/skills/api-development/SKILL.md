---
name: api-development
description: Patterns for building Next.js API routes in TaxHelper. Use when creating or modifying /api/ routes, adding authentication, validation, rate limiting, or error handling.
---

# API Development Skill

This skill provides patterns for building consistent, secure API routes in TaxHelper.

## When to Use This Skill

- Creating new API endpoints
- Adding authentication to routes
- Implementing request validation
- Adding rate limiting
- Handling errors consistently
- Working with Prisma in API routes

## Project Conventions

- Location: `src/app/api/[resource]/route.ts`
- Auth helper: `getAuthUser()` from `@/lib/api-utils`
- Validation: Zod schemas in `@/lib/schemas.ts`
- Rate limiting: `checkRateLimit()` from `@/lib/rate-limit`
- Logging: `logger` from `@/lib/logger`

## API Route Template

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { myQuerySchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  let userId: string | undefined;

  try {
    // 1. Authentication
    const user = await getAuthUser();
    if (!user) {
      return attachRequestId(ApiErrors.unauthorized(), requestId);
    }
    userId = user.id;

    // 2. Rate limiting
    const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.api);
    if (!rateLimitResult.success) {
      return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
    }

    // 3. Parse and validate query params
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const parseResult = myQuerySchema.safeParse(params);
    if (!parseResult.success) {
      return attachRequestId(
        ApiErrors.validation(
          parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        ),
        requestId
      );
    }

    // 4. Business logic / database query
    const data = await prisma.myModel.findMany({
      where: { userId: user.id },
    });

    // 5. Return response with headers
    const response = NextResponse.json(data);
    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("X-Request-Id", requestId);

    return response;
  } catch (error) {
    logger.error("Error in API route", {
      requestId,
      userId,
      path: request.nextUrl.pathname,
      method: request.method,
      error,
    });
    return attachRequestId(ApiErrors.internal(), requestId);
  }
}
```

## Authentication

```typescript
import { getAuthUser, ApiErrors } from "@/lib/api-utils";

// Get authenticated user (returns null if not authenticated)
const user = await getAuthUser();
if (!user) {
  return ApiErrors.unauthorized();
}

// user.id is always available
// user.email and user.name may be null
```

## Rate Limiting

Three configurations available:

```typescript
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";

// Standard API: 100 requests/minute
const result = await checkRateLimit(userId, RateLimitConfig.api);

// Mutations: 30 requests/minute
const result = await checkRateLimit(userId, RateLimitConfig.mutation);

// Auth endpoints: 10 requests/minute
const result = await checkRateLimit(userId, RateLimitConfig.auth);

if (!result.success) {
  return rateLimitedResponse(result);
}
```

## Validation with Zod

Define schemas in `src/lib/schemas.ts`:

```typescript
import { z } from "zod";

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["SALES_TAX", "INCOME_TAX", "OTHER"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const transactionCreateSchema = z.object({
  date: z.string().datetime(),
  type: z.enum(["SALES_TAX", "INCOME_TAX", "OTHER"]),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  merchant: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
});
```

Parse query params:

```typescript
const parseResult = myQuerySchema.safeParse(params);
if (!parseResult.success) {
  return ApiErrors.validation(
    parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
  );
}
const { page, limit, type } = parseResult.data;
```

Parse request body:

```typescript
import { parseRequestBody } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const bodyResult = await parseRequestBody(request, transactionCreateSchema);
  if (!bodyResult.success) {
    return bodyResult.error;
  }
  const { date, type, totalAmount } = bodyResult.data;
}
```

## Error Responses

Use consistent error helpers:

```typescript
import { ApiErrors } from "@/lib/api-utils";

ApiErrors.unauthorized()           // 401 - Not authenticated
ApiErrors.forbidden()              // 403 - Not authorized
ApiErrors.notFound("Transaction")  // 404 - Resource not found
ApiErrors.validation("message")    // 400 - Validation error
ApiErrors.rateLimited()            // 429 - Too many requests
ApiErrors.internal()               // 500 - Server error
```

## Request ID Tracking

Always track request IDs for debugging:

```typescript
import { getRequestId, attachRequestId } from "@/lib/api-utils";

const requestId = getRequestId(request);

// Attach to all responses
return attachRequestId(response, requestId);

// Include in error logs
logger.error("Error", { requestId, error });
```

## Dynamic Route Parameters

For routes like `/api/transactions/[id]/route.ts`:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const transaction = await prisma.transaction.findUnique({
    where: { id, userId: user.id },
  });
  
  if (!transaction) {
    return ApiErrors.notFound("Transaction");
  }
}
```

## Prisma Aggregations

Use database-level aggregations for performance:

```typescript
// Aggregate totals
const aggregations = await prisma.transaction.aggregate({
  where: { userId: user.id },
  _sum: { taxAmount: true, totalAmount: true },
  _count: true,
});

// Group by field
const byType = await prisma.transaction.groupBy({
  by: ['type'],
  where: { userId: user.id },
  _sum: { taxAmount: true },
});

// Raw SQL for complex queries
const dailyTotals = await prisma.$queryRaw<Array<{ date: Date; total: Decimal }>>`
  SELECT DATE("date") as date, SUM("taxAmount") as total
  FROM "Transaction"
  WHERE "userId" = ${user.id}
  GROUP BY DATE("date")
`;
```

## Response Format Conventions

### Success responses

```typescript
// Single resource
NextResponse.json({ id, date, amount, ... });

// List with pagination
NextResponse.json({
  data: [...],
  pagination: { page, limit, total, pages },
});

// Summary/aggregate data
NextResponse.json({
  totalTax: "123.45",
  transactionCount: 42,
  byType: { SALES_TAX: "100.00", ... },
});
```

### Decimal handling

Always return decimals as strings to preserve precision:

```typescript
const response = {
  totalAmount: transaction.totalAmount.toString(),
  taxAmount: transaction.taxAmount.toString(),
};
```
