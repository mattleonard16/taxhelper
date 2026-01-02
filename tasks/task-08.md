# Task 08 — Extract Reports Generation Module

## Description

Implement `plan/feature/05-reports-generation-module.md`:

- Move report generation logic out of `src/app/api/reports/route.ts` into `src/lib/export/` (or a dedicated `src/lib/reports/`)
- Keep the API route thin (request parsing + auth + response)
- Add unit tests for report generation outputs (CSV/PDF as supported)

## Files / Modules Affected

- `src/app/api/reports/route.ts`
- `src/lib/export/*` (or new module)
- Tests in `src/lib/**/__tests__/`

## Dependencies

- Task 01

## Acceptance Criteria

- [ ] Report generation logic is reusable and unit-tested
- [ ] API route remains behaviorally identical from the client’s perspective
- [ ] API tests (if present) remain green

## Complexity

Medium

