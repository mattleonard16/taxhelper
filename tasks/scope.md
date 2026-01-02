# Scope

## Big Goal

Big goal: **Ship the full Task 00–Task 10 plan end-to-end: complete each task on its own new branch, and for every task ensure `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, and `npx prisma validate` all pass, with docs updated whenever behavior/env/workflow changes.**

## In-Scope Work (Plan-Driven Tasks)

These tasks align with existing feature plans in `plan/feature/00-priority.md` and are executed in order:

1. Dashboard data fetch + state hook
2. Transaction list refactor (virtualized + selection)
3. Receipt processing service abstraction
4. Reports generation module extraction
5. Recurring schedule/calculation service
6. Insights bulk IDs API (reduce client chunk loops)

Foundational fixes and consistency work are also in scope (Dev Login alignment, export contract alignment, API auth consistency).

## Relevant Codebase Areas

- Routing & pages: `src/app/(app)/*`, `src/app/auth/*`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`
- API routes: `src/app/api/*`
- Data access: `src/lib/prisma.ts`, `prisma/schema.prisma`, `prisma/migrations/*`
- Auth: `src/lib/auth.ts`, `src/lib/api-utils.ts`
- Receipts/LLM: `src/lib/receipt/*`, `src/lib/llm/*`, `src/app/api/receipts/*`, `src/components/receipts/*`
- Insights: `src/lib/insights/*`, `src/app/api/insights/*`, `src/components/insights/*`
- Transactions UI: `src/components/transactions/*`
- Shared infra: `src/lib/rate-limit.ts`, `src/lib/logger.ts`, `src/lib/env.ts`
- Tests: `src/app/api/__tests__/*`, `src/lib/**/__tests__/*`, `e2e/*`
- Planning artifacts: `tasks/*`, `plan/feature/*`

## Dependencies & Prerequisites

- Node.js + npm (per `package.json`)
- Database available and migrated: `npx prisma migrate dev`
- Required env vars: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- Quality gates per task:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `npx prisma validate`
- Optional but commonly needed:
  - Receipt extraction: `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`)
  - E2E dev flows: dev login vars (`ENABLE_DEV_LOGIN`, `NEXT_PUBLIC_ENABLE_DEV_LOGIN`, etc.)
  - Cron/admin features: `CRON_SECRET`, `ADMIN_EMAILS`/`ADMIN_USER_IDS`
  - Rate limiting: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

## Risks & Considerations

- E2E currently assumes a “Dev Login” UI button exists; if missing, Playwright auth flows will fail.
- `/api/export` API contract differs from how the UI calls it; fixing requires deciding the intended export UX (year-based ZIP vs selected-ids CSV).
- Export ZIP includes receipt files only if receipt bytes are loaded, not just paths.
- Receipt pipeline spans sync upload, async jobs, storage, OCR, LLM, caching, and confirmation into transactions; changes here require strong tests.
- Next.js App Router split between server and client components; watch for accidental server-only imports in client components.
- Quality-gate failures (type-check, lint, tests, build, prisma validate) will block progress until resolved.

## Out of Scope (For This Plan)

- New features outside tasks `task-00` through `task-10`
- UI/UX redesigns beyond what is required by the scoped tasks
- Infrastructure changes not required to satisfy quality gates

## Success Criteria (Fill In When Goal Is Set)

- [ ] All tasks `task-00` through `task-10` are completed in order, each on its own branch and pushed to origin.
- [ ] For every task branch: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, and `npx prisma validate` pass.
- [ ] Documentation is updated for any behavior, environment, or workflow changes.
- [ ] No regressions in Playwright flows for auth + core pages.
