# Task 06 — Transaction List Refactor (Virtualization + Selection)

## Description

Implement `plan/feature/03-transaction-list-refactor.md`:

- Split virtualization concerns from rendering/UI concerns
- Extract selection state and handlers into a dedicated hook
- Preserve E2E test IDs and behavior

## Files / Modules Affected

- `src/components/transactions/transaction-list.tsx`
- New extracted components/hooks under `src/components/transactions/` and/or `src/hooks/`
- Any pages using the list:
  - `src/app/(app)/transactions/page.tsx`
  - `src/app/(app)/dashboard/page.tsx` (if it embeds a list)
- Tests: unit tests and/or E2E stability updates

## Dependencies

- Task 01
- Task 05 (recommended if dashboard refactor touches the same data plumbing)

## Acceptance Criteria

- [ ] No E2E selector/test-id changes (or they’re updated intentionally with justification)
- [ ] Selection works across virtualization boundaries
- [ ] Bulk actions still operate on selected ids correctly
- [ ] Performance does not regress for large lists

## Complexity

High

