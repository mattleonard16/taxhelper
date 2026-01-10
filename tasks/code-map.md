# TaxHelper Code Map

This map focuses on the “highest signal” areas you listed: `src/app/api/`, `src/app/(app)/`, `src/app/auth/`, key `src/lib/*` business logic, related `src/components/*`, `prisma/`, unit/API tests, and `e2e/`.

## Directory Structure (High-Signal)

```
src/
  app/
    layout.tsx                     # Root layout: providers + analytics + SW registration
    (app)/
      layout.tsx                   # Authenticated layout: session gate + navigation
      dashboard/page.tsx
      transactions/page.tsx
      templates/page.tsx
      receipts/page.tsx
      insights/page.tsx
      deductions/page.tsx
      recurring/page.tsx
      reports/page.tsx
      settings/page.tsx
      error.tsx                    # Authenticated shell error boundary
      insights/error.tsx
      transactions/error.tsx
    auth/
      signin/page.tsx              # Public sign-in
      signup/page.tsx              # Public sign-up
      error/page.tsx               # Auth error page
    api/
      auth/
        [...nextauth]/route.ts     # NextAuth handler
        register/route.ts          # Credentials registration
      transactions/
        route.ts                   # GET/POST
        [id]/route.ts              # GET/PATCH/DELETE
        batch/route.ts             # PATCH/DELETE for many ids
      templates/
        route.ts                   # GET/POST
        [id]/route.ts              # PATCH/DELETE
      summary/route.ts             # Aggregated totals/time-series/top merchants
      insights/
        route.ts                   # GET ranked insights (range, refresh)
        [id]/route.ts              # PATCH pinned/dismissed
        deductions/route.ts        # GET deductible candidates
      receipts/
        upload/route.ts            # POST receipt upload (sync or ?async=1)
        process/route.ts           # POST worker trigger / requeue stale
        jobs/route.ts              # GET list / PATCH status / etc.
        jobs/[id]/route.ts         # GET/PATCH/DELETE
        jobs/[id]/retry/route.ts
        jobs/[id]/confirm/route.ts
        inbox/route.ts             # GET inbox list
        stats/route.ts             # GET dashboard stats (jobs + categories)
      recurring/
        route.ts                   # GET/POST
        [id]/route.ts              # PATCH/DELETE
        generate/route.ts          # POST generate instances
      reports/route.ts             # GET/POST report generation
      export/route.ts              # GET year-based ZIP export
      onboarding/route.ts
      settings/route.ts
      sample-data/route.ts
      dev/seed/route.ts            # Dev-only seed
      cron/cleanup-cache/route.ts  # Cleanup ReceiptExtractionCache

  lib/
    prisma.ts                      # Neon + Prisma client
    env.ts                         # Env validation helpers (subset)
    auth.ts                        # NextAuth config + providers + dev login in auth layer
    api-utils.ts                   # getAuthUser + ApiErrors + request id helpers
    rate-limit.ts                  # Upstash-backed limiter (optional)
    logger.ts                      # structured logs
    transactions/transaction-search.ts
    insights/*                     # generators + caching + persistence
    receipt/*                      # storage + OCR + LLM + jobs + worker + cache
    export/*                       # CSV + ZIP building utilities
    deductions/*                   # rules-engine + summaries
    llm/*                          # retry, errors, rate limiter, cost tracking

  components/
    navigation.tsx, mobile-nav.tsx, providers.tsx
    dashboard/*                    # charts + receipt stats UI
    transactions/*                 # list + selection + bulk actions + receipt scanner
    receipts/*                     # receipt review drawer
    insights/*                     # insight card UI
    ui/*                           # shadcn/ui primitives

prisma/
  schema.prisma
  migrations/*/migration.sql

src/app/api/__tests__/*            # API route tests
src/lib/**/__tests__/*             # unit tests for lib utilities
e2e/*.spec.ts                      # Playwright flows
```

## Key Modules & Responsibilities

- `src/lib/prisma.ts`: Prisma client configured for Neon serverless Postgres.
- `src/lib/auth.ts`: NextAuth config (Credentials + optional Google/Email), plus auth-layer dev-login support.
- `src/lib/api-utils.ts`: Shared API helpers (`getAuthUser`, standard error JSON, request IDs).
- `src/lib/rate-limit.ts`: Rate limiting, Upstash-backed when configured, in-memory fallback.
- `src/lib/receipt/*`: Receipt pipeline: store bytes → OCR → LLM extraction → caching → job state machine → confirm into `Transaction`.
- `src/lib/insights/*`: Insight generation (pure-ish generators) + persistence (`InsightRun`, `Insight`) + cache policy/invalidation.
- `src/lib/transactions/transaction-search.ts`: Build Prisma `where` clauses from query params for list filtering.
- `src/lib/export/*`: CSV and ZIP construction helpers for year-based export.
- `src/components/*`: UI implementations that bind pages to API endpoints.

## Data Model (Prisma)

Core models (non-exhaustive):

- `User`: Preferences + auth relations; parent for most domain data.
- `Transaction`: Core ledger entry; includes `type`, amounts, and categorization (`category`, `categoryCode`, `isDeductible`) + optional `receiptPath`.
- `TaxTemplate`: Saved defaults for transaction entry.
- `RecurringTransaction`: Schedule template for generating future transactions.
- `InsightRun` + `Insight`: Persisted insights per user and time range; supports `pinned`/`dismissed` and explainability JSON.
- `ReceiptJob`: Async receipt processing state machine; stores extracted fields + categorization + `transactionId` link once confirmed.
- `ReceiptCorrection`: Audit trail of user edits to extracted receipt fields.
- `ReceiptExtractionCache`: Prisma-backed cache keyed by receipt hash (used to skip repeated LLM work).
- `LlmDailyUsage`: Per-user/day LLM cost + request tracking.
- NextAuth tables: `Account`, `Session`, `VerificationToken`.

## API Endpoints (App Router `route.ts`)

Note: many routes return `{ error, code? }` style JSON on failure; some also attach a request ID via helpers.

### Auth

- `POST /api/auth/register` (`src/app/api/auth/register/route.ts`): create credentials user.
- `GET|POST /api/auth/[...nextauth]` (`src/app/api/auth/[...nextauth]/route.ts`): NextAuth handler.

### Transactions

- `GET /api/transactions` (`src/app/api/transactions/route.ts`): list, filtered; some clients also request by `ids` for drill-down.
- `POST /api/transactions` (`src/app/api/transactions/route.ts`): create.
- `GET|PATCH|DELETE /api/transactions/:id` (`src/app/api/transactions/[id]/route.ts`): read/update/delete.
- `PATCH|DELETE /api/transactions/batch` (`src/app/api/transactions/batch/route.ts`): bulk update/delete by ids.

### Templates / Summary / Settings / Onboarding

- `GET|POST /api/templates` (`src/app/api/templates/route.ts`)
- `PATCH|DELETE /api/templates/:id` (`src/app/api/templates/[id]/route.ts`)
- `GET /api/summary` (`src/app/api/summary/route.ts`): dashboard aggregation.
- `GET|PATCH /api/settings` (`src/app/api/settings/route.ts`): user preferences.
- `GET|POST /api/onboarding` (`src/app/api/onboarding/route.ts`): onboarding state.
- `POST /api/sample-data` (`src/app/api/sample-data/route.ts`): add demo data.
- `POST /api/dev/seed` (`src/app/api/dev/seed/route.ts`): seed helper (dev).

### Insights

- `GET /api/insights?range=30&refresh=1` (`src/app/api/insights/route.ts`): generate-or-fetch ranked insights.
- `PATCH /api/insights/:id` (`src/app/api/insights/[id]/route.ts`): pin/dismiss state updates.
- `GET /api/insights/deductions` (`src/app/api/insights/deductions/route.ts`): deduction candidates.

### Receipts

- `POST /api/receipts/upload` (`src/app/api/receipts/upload/route.ts`):
  - sync (default): process inline (OCR/LLM) and return extracted fields
  - async (`?async=1`): persist bytes + enqueue `ReceiptJob`
- `POST /api/receipts/process` (`src/app/api/receipts/process/route.ts`): cron/admin trigger; requeues stale jobs and processes queued work.
- `GET /api/receipts/jobs` (`src/app/api/receipts/jobs/route.ts`): list jobs.
- `GET|PATCH|DELETE /api/receipts/jobs/:id` (`src/app/api/receipts/jobs/[id]/route.ts`): job details, updates, delete/discard.
- `POST /api/receipts/jobs/:id/retry` (`src/app/api/receipts/jobs/[id]/retry/route.ts`): requeue.
- `POST /api/receipts/jobs/:id/confirm` (`src/app/api/receipts/jobs/[id]/confirm/route.ts`): create/link `Transaction` (idempotent via unique `transactionId`).
- `GET /api/receipts/inbox` (`src/app/api/receipts/inbox/route.ts`): inbox view.
- `GET /api/receipts/stats` (`src/app/api/receipts/stats/route.ts`): dashboard receipt stats + category breakdown + avg confidence.

### Recurring / Reports / Export

- `GET|POST /api/recurring` (`src/app/api/recurring/route.ts`)
- `PATCH|DELETE /api/recurring/:id` (`src/app/api/recurring/[id]/route.ts`)
- `POST /api/recurring/generate` (`src/app/api/recurring/generate/route.ts`): generate occurrences from schedules.
- `GET|POST /api/reports` (`src/app/api/reports/route.ts`): report generation endpoint.
- `GET /api/export?year=2024` (`src/app/api/export/route.ts`): year-based ZIP export (CSV + organized receipt folders).

### Cron

- `GET|POST /api/cron/cleanup-cache` (`src/app/api/cron/cleanup-cache/route.ts`): deletes expired `ReceiptExtractionCache` rows.

## Main Data Flows & Dependencies

### Auth / Routing Gate

1. User visits a protected route under `src/app/(app)/*`.
2. `src/app/(app)/layout.tsx` checks session (server-side) and redirects to `/auth/signin` if missing.
3. API routes typically call `getAuthUser()` (`src/lib/api-utils.ts`) which wraps NextAuth session retrieval.

### Transactions

1. UI fetches `GET /api/transactions` for lists and filtered queries.
2. Search parsing lives in `src/lib/transactions/transaction-search.ts` → Prisma `where` clauses.
3. Categorization fields can be set manually (bulk actions) or synced from receipts.

### Receipts (Sync + Async)

1. Upload hits `POST /api/receipts/upload`.
2. Storage uses `src/lib/receipt/receipt-storage.ts` (local `.receipt-storage` by default).
3. Extraction path:
   - OCR first (`src/lib/receipt/receipt-ocr.ts`)
   - LLM fallback (`src/lib/receipt/receipt-llm.ts`) if OCR confidence is low or required fields are missing
   - Cache (`src/lib/receipt/receipt-cache.ts`) to skip reprocessing identical content
4. Async path persists a `ReceiptJob` and queues processing; `POST /api/receipts/process` drives the worker (`src/lib/receipt/receipt-job-worker.ts`).
5. User review/confirm creates a `Transaction` and links it to `ReceiptJob.transactionId` (unique to prevent double-posting).

### Insights

1. UI calls `GET /api/insights?range=N`.
2. `src/lib/insights/index.ts` decides “use cached persisted run” vs “recompute” based on cache policy and transaction freshness.
3. Generators (`src/lib/insights/*.ts`) return ranked insights persisted to `InsightRun`/`Insight`.

## External Integrations

- **DB**: Neon Postgres + Prisma.
- **Auth**: NextAuth (Credentials + optional Google OAuth + optional Email magic link).
- **LLM**: OpenAI (primary) and Anthropic (fallback) via `fetch`; usage tracked via Prisma tables.
- **Rate limiting**: Upstash Redis (optional), in-memory fallback.
- **Charts**: Recharts (`src/components/dashboard/*`).
- **ZIP generation**: `jszip`.
- **PWA**: service worker (`public/sw.js`) registered via `src/components/service-worker-registration.tsx`.
- **Analytics**: Vercel Analytics in root layout.

## Configuration Requirements (Env Vars)

Required for local + CI sanity:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Common optional flags/integrations:

- Auth UI toggles: `NEXT_PUBLIC_HAS_GOOGLE_AUTH`, `NEXT_PUBLIC_HAS_EMAIL_AUTH`
- Providers: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_SERVER`, `EMAIL_FROM`
- Dev login: `ENABLE_DEV_LOGIN`, `DEV_LOGIN_EMAIL`, `DEV_LOGIN_PASSWORD`, `NEXT_PUBLIC_ENABLE_DEV_LOGIN`, `NEXT_PUBLIC_DEV_LOGIN_EMAIL`, `NEXT_PUBLIC_DEV_LOGIN_PASSWORD`
- LLM: `OPENAI_API_KEY` (and/or `ANTHROPIC_API_KEY`)
- Rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Insights caching: `INSIGHT_CACHE_TTL_HOURS`
- Cron/admin: `CRON_SECRET`, `ADMIN_EMAILS`, `ADMIN_USER_IDS`

## Tests & Verification

- Unit + API tests: Vitest (`src/lib/**/__tests__/*`, `src/app/api/__tests__/*`).
- E2E: Playwright (`e2e/*.spec.ts`), including auth flows, insights drill-down, receipts inbox, and mobile nav behavior.

## Known Mismatches / Risks (Worth Fixing Early)

- **Dev Login UI vs E2E**: `e2e/auth.spec.ts` expects a “Dev Login” button, but `src/app/auth/signin/page.tsx` currently has no dev login button logic.
- **Export contract mismatch**: UI bulk export calls `/api/export?format=csv&ids=...` (`src/components/transactions/bulk-actions-bar.tsx`), but `src/app/api/export/route.ts` expects `year` and returns a ZIP.
- **Export ZIP likely missing receipts**: `src/lib/export/zip-creator.ts` only includes receipts when `content` buffers are provided; `src/app/api/export/route.ts` passes only paths, so ZIP likely contains only the CSV.
- **Auth helper inconsistency**: Most API routes use `getAuthUser()` (`src/lib/api-utils.ts`), but `src/app/api/receipts/stats/route.ts` uses `getServerSession()` directly (inconsistent error shape and request-id behavior).
- **Repo-local build artifacts**: `.next/` exists in the workspace; ensure planning/verification refers to `src/` sources, not stale build output.

