# Task 09 — Recurring Schedule/Calculation Service

## Description

Implement `plan/feature/06-recurring-scheduler-service.md`:

- Extract recurring “next run date” and amount/tax calculations into `src/lib/recurring/`
- Keep `src/app/api/recurring/generate/route.ts` focused on IO and persistence

## Files / Modules Affected

- New: `src/lib/recurring/*`
- `src/app/api/recurring/generate/route.ts`
- Tests under `src/lib/**/__tests__/`

## Dependencies

- Task 01

## Acceptance Criteria

- [ ] Date calculations are deterministic and unit-tested
- [ ] Generated transactions match existing behavior
- [ ] Recurring API tests (if any) remain green

## Complexity

Medium

