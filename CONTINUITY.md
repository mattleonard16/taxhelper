# CONTINUITY.md

## Goal (incl. success criteria):
Implement Dashboard Balance Component - shows total income minus expenses

## Constraints/Assumptions:
- Data from /api/summary endpoint
- Balance = income - expenses for selected period

## Key decisions:
- Added `byTypeTotals` to `/api/summary` for totalAmount by type.

## State:
## Done:
- Initialized plan at plan/feature/01-dashboard-balance-component.md
- Defined balance UI spec (card with balance + income/expenses breakdown).
- Added summary `byTypeTotals` API output.
- Implemented `BalanceCard` and wired into dashboard.
- Added unit tests for balance calculation.
- Updated README feature list for balance.
- Deleted plan file for the completed balance component.

## Now:
(none)

## Next:
- Start the next priority in `plan/feature/00-priority.md` when ready.

## Open questions:
(none)

## Working set:
- src/app/api/summary/route.ts
- src/app/api/__tests__/summary.test.ts
- src/components/dashboard/balance-card.tsx
- src/components/dashboard/__tests__/balance-card.test.tsx
- src/app/(app)/dashboard/page.tsx
