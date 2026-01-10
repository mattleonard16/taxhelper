# Task 05 — Dashboard Data Hook (`useDashboardData`)

## Description

Implement the feature plan in `plan/feature/02-dashboard-data-hook.md`:

- Centralize dashboard data fetching (summary, transactions, receipt stats, etc.)
- Provide unified loading/error/refresh handling
- Reduce direct `fetch` calls in `src/app/(app)/dashboard/page.tsx`

## Files / Modules Affected

- `src/hooks/use-dashboard-data.ts` (new)
- `src/app/(app)/dashboard/page.tsx`
- Potential fetch helpers or typed clients under `src/lib/` (optional)
- Tests: new hook tests under `src/hooks/__tests__/` or existing test conventions

## Dependencies

- Task 01

## Acceptance Criteria

- [ ] Dashboard renders the same data as before (no regressions)
- [ ] Hook exposes clear API: `data`, `loading`, `error`, `refresh`
- [ ] Hook has unit tests with mocked `fetch`
- [ ] Playwright dashboard flows still pass

## Complexity

Medium

