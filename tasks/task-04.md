# Task 04 — Normalize API Auth + Error/Request-ID Conventions

## Description

Standardize API route behaviors:

- Use a consistent auth helper (prefer `getAuthUser()` from `src/lib/api-utils.ts`).
- Ensure consistent error response shapes (e.g., `{ error, code? }`) and request ID propagation where applicable.
- Align outliers like `src/app/api/receipts/stats/route.ts` which uses `getServerSession()` directly.

## Files / Modules Affected

- `src/lib/api-utils.ts`
- API routes (starting with `src/app/api/receipts/stats/route.ts`)
- `src/app/api/__tests__/*` (only if error shapes/auth changes impact tests)

## Dependencies

- Task 01

## Acceptance Criteria

- [ ] All protected routes enforce auth consistently
- [ ] Unauthorized responses are consistent across APIs
- [ ] Request IDs are attached in the same way where already supported
- [ ] API test suite remains green

## Complexity

Medium

