---
name: software-architecture
description: Senior Staff Engineer guidance for Clean Architecture, SOLID principles, and Domain-Driven Design. Use for refactoring, planning new modules, or reviewing code organization.
---

# Software Architecture Skill

This skill provides architectural guidance specific to the TaxHelper codebase.

## When to Use This Skill

- Planning new features or modules
- Refactoring existing code
- Reviewing code organization
- Deciding where new code belongs
- Understanding the layered architecture

## Project Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated routes (dashboard, transactions, insights)
│   ├── api/                # API routes (REST endpoints)
│   └── auth/               # Public auth pages
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives (Button, Card, etc.)
│   └── [feature]/          # Feature-specific components
├── lib/                    # Core business logic (PURE FUNCTIONS)
│   ├── receipt/            # Receipt processing domain
│   ├── insights/           # Insight generation domain
│   └── [shared]/           # Shared utilities
└── types/                  # Shared TypeScript types
```

## Core Principles

### 1. Clean Architecture Layers

```
┌─────────────────────────────────────────────┐
│              Presentation Layer             │
│    (React Components, App Router Pages)     │
├─────────────────────────────────────────────┤
│               API Layer                     │
│    (Route handlers in src/app/api/)         │
├─────────────────────────────────────────────┤
│             Service Layer                   │
│    (Business logic in src/lib/)             │
├─────────────────────────────────────────────┤
│           Infrastructure Layer              │
│    (Prisma, External APIs, Storage)         │
└─────────────────────────────────────────────┘
```

**Dependencies flow inward.** Components depend on services; services depend on repositories; repositories depend on Prisma.

### 2. Service Layer in `src/lib/`

Keep business logic in pure functions:

```typescript
// ✅ Good: Pure function in src/lib/
export function calculateBalanceTotals(totals: BalanceTotals) {
  const income = parseAmount(totals.INCOME_TAX);
  const expenses = parseAmount(totals.SALES_TAX) + parseAmount(totals.OTHER);
  return { income, expenses, balance: income - expenses };
}

// ❌ Bad: Business logic in component
function BalanceCard({ totals }) {
  // Don't compute business logic here
  const income = Number(totals.INCOME_TAX) || 0;
  // ...
}
```

### 3. Early Returns (Guard Clauses)

Reduce nesting with early returns:

```typescript
// ✅ Good: Guard clauses
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return ApiErrors.unauthorized();

  const result = schema.safeParse(params);
  if (!result.success) return ApiErrors.validation(result.error.message);

  // Happy path at bottom
  return NextResponse.json(data);
}

// ❌ Bad: Deeply nested
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (user) {
    const result = schema.safeParse(params);
    if (result.success) {
      // ...deeply nested
    }
  }
}
```

### 4. Domain Module Structure

Each domain (like `receipt/`) should follow this pattern:

```
src/lib/receipt/
├── index.ts                    # Public API exports
├── receipt-extraction.ts       # Core extraction logic
├── receipt-ocr.ts              # OCR parsing
├── receipt-llm.ts              # LLM extraction
├── receipt-storage.ts          # File storage
├── receipt-job-repository.ts   # Database access
├── receipt-jobs-service.ts     # Orchestration service
└── __tests__/                  # Co-located tests
    ├── receipt-extraction.test.ts
    └── receipt-storage.test.ts
```

### 5. Repository Pattern

Separate data access from business logic:

```typescript
// Repository: Data access only
export async function findPendingJobs(userId: string) {
  return prisma.receiptJob.findMany({
    where: { userId, status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
  });
}

// Service: Business logic using repository
export async function processNextJob(userId: string) {
  const jobs = await findPendingJobs(userId);
  if (jobs.length === 0) return null;
  
  const job = jobs[0];
  // Business logic here...
}
```

## Where Does New Code Go?

| Code Type | Location |
|-----------|----------|
| API endpoint | `src/app/api/[resource]/route.ts` |
| React component | `src/components/[feature]/` |
| UI primitive | `src/components/ui/` (shadcn) |
| Business logic | `src/lib/[domain]/` |
| Database access | `src/lib/[domain]/*-repository.ts` |
| Type definitions | `src/types/index.ts` |
| Zod schemas | `src/lib/schemas.ts` |
| Utilities | `src/lib/utils.ts` or domain-specific |

## Testing Strategy

- **Unit tests**: Pure functions in `src/lib/` (Vitest)
- **Component tests**: React components with mocked APIs (Vitest)
- **E2E tests**: Full user flows (Playwright in `e2e/`)

Co-locate tests in `__tests__/` folders near the code they test.

## Common Patterns

### API Route Template

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, ApiErrors, getRequestId, attachRequestId } from "@/lib/api-utils";
import { checkRateLimit, RateLimitConfig, rateLimitedResponse } from "@/lib/rate-limit";
import { mySchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  
  const user = await getAuthUser();
  if (!user) return attachRequestId(ApiErrors.unauthorized(), requestId);

  const rateLimitResult = await checkRateLimit(user.id, RateLimitConfig.api);
  if (!rateLimitResult.success) {
    return attachRequestId(rateLimitedResponse(rateLimitResult), requestId);
  }

  // Validation, business logic, response...
}
```

### Component with API Data

```typescript
"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export function MyComponent() {
  const { data, error, isLoading } = useSWR("/api/resource", fetcher);
  
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState />;
  
  return <div>{/* Render data */}</div>;
}
```
