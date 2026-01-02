# Task 07 — Receipt Processing Service Abstraction

## Description

Implement `plan/feature/04-receipt-processing-abstraction.md`:

- Introduce a shared “receipt processing service” interface in `src/lib/receipt/`
- Consolidate extraction + error mapping logic used by:
  - sync upload path
  - async worker processing path
- Improve testability and reduce divergence between flows

## Files / Modules Affected

- `src/lib/receipt/*` (new service module; refactors across upload/worker)
- `src/app/api/receipts/upload/route.ts`
- `src/app/api/receipts/process/route.ts`
- `src/lib/receipt/receipt-job-worker.ts`
- Tests:
  - `src/lib/receipt/__tests__/*`
  - `src/app/api/__tests__/receipts-upload.test.ts`

## Dependencies

- Task 01

## Acceptance Criteria

- [ ] Sync and async flows produce equivalent extracted fields for the same receipt
- [ ] Errors are mapped consistently to job statuses (`FAILED`, `NEEDS_REVIEW`, etc.)
- [ ] Receipt processing tests cover both modes
- [ ] No regressions in receipts inbox/review flows (E2E)

## Complexity

High

