# Task 10 — Insights Bulk IDs Endpoint

## Description

Implement `plan/feature/07-insights-bulk-ids-endpoint.md`:

- Add a POST endpoint to fetch transactions by a list of IDs (safer than long query strings)
- Update insights client logic to use it and reduce chunked loops
- Add safeguards for large ID lists (limits, pagination, validation)

## Files / Modules Affected

- New API route (proposed): `src/app/api/transactions/bulk/route.ts` or similar
- `src/app/(app)/insights/page.tsx` (or its client helpers)
- `src/lib/transactions/*` (optional shared validation)
- Tests:
  - `src/app/api/__tests__/*`
  - `e2e/insights*.spec.ts` (only if flow changes)

## Dependencies

- Task 01

## Acceptance Criteria

- [ ] Bulk endpoint accepts IDs in request body and returns matching transactions
- [ ] Endpoint is auth-protected and user-scoped (no cross-user reads)
- [ ] Client no longer needs chunked ID loops for insight drill-down
- [ ] Tests cover validation and large-list behavior

## Complexity

Medium

