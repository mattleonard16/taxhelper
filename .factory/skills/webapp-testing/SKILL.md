---
name: webapp-testing
description: Playwright E2E testing patterns for TaxHelper. Use for auth redirects, insights drill-down, mobile viewport checks, and PWA verification.
---

# Webapp Testing Skill

## Scope
- Use when adding or fixing Playwright E2E tests in `e2e/`.
- Keep tests deterministic by mocking API routes instead of hitting Prisma.
- Prefer user-visible behavior checks over implementation details.

## Project Conventions
- Test location: `e2e/*.spec.ts`
- Runner: `npm run test:e2e`
- Base URL: `http://127.0.0.1:3001` from `playwright.config.ts`

## Auth And Fixtures
- Use `addAuthSession` from `e2e/fixtures/auth-session.ts` for authenticated tests.
- Use `mockInsightsRoutes` from `e2e/fixtures/insights-api.ts` to stub:
  - `GET /api/insights`
  - `GET /api/transactions`
  - `GET /api/settings`
- When adding new authenticated tests, ensure `/api/settings` is stubbed to avoid Prisma errors.

## Common Patterns
### Auth Redirect
- Navigate to a protected route (ex: `/dashboard`) without auth.
- Expect URL to contain `/auth/signin`.

### Insights Drill-Down
- Stub insights and transactions via `mockInsightsRoutes`.
- Use the aria label on the toggle button:
  - `page.getByRole("button", { name: /show transactions for/i })`

### Mobile Viewport
- Set `test.use({ viewport: { width: 390, height: 844 } })`.
- Assert the nav is visible via `data-testid="mobile-nav"`.
- Verify main padding bottom is at least the nav height.

### Service Worker
- Avoid network interception flakiness.
- Assert registration scope exists:
  - `navigator.serviceWorker.getRegistration()` and check `scope`.

## Reliability Tips
- Use `page.context().route` for API stubs to guarantee interception.
- Prefer `getByRole` and `getByText` with stable labels.
- Add `data-testid` only when no stable accessible label exists.
