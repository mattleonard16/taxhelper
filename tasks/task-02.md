# Task 02 — Restore Dev Login UI (Align With E2E + README)

## Description

Playwright E2E tests assume a “Dev Login” button exists on `/auth/signin`, but the current UI (`src/app/auth/signin/page.tsx`) doesn’t render it. Re-introduce a dev-login button gated by env vars in a safe way.

This task should align:

- The sign-in UI (button + behavior)
- The auth layer dev-login support (`src/lib/auth.ts`)
- E2E expectations (`e2e/auth.spec.ts`)
- Docs (`README.md`, `.env.example`) if needed

## Files / Modules Affected

- `src/app/auth/signin/page.tsx`
- `src/lib/auth.ts` (only if UI needs a new provider or helper)
- `e2e/auth.spec.ts` (only if contract changes)
- `README.md`, `.env.example` (only if behavior/env flags differ)

## Dependencies

- Task 01

## Acceptance Criteria

- [ ] `/auth/signin` shows a “Dev Login” button when `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`
- [ ] Clicking “Dev Login” signs in and redirects to `/dashboard` (and honors `callbackUrl`)
- [ ] “Dev Login” button is hidden/disabled when not explicitly enabled
- [ ] `e2e/auth.spec.ts` passes without weakening assertions

## Complexity

Medium

