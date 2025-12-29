# Feature Plan: Transaction List Refactor

Context
- `src/components/transactions/transaction-list.tsx` mixes virtualization, selection, and UI logic.
- Goal: split into smaller components + reusable selection logic.

Checklist
- [ ] Split virtualized and non-virtualized renderers into separate files.
- [ ] Extract selection state/handlers into a hook.
- [ ] Keep test IDs intact for E2E stability.
- [ ] Update imports/usages in dashboard and transactions pages.
- [ ] Add/update tests for selection and virtualization behavior.
- [ ] Update docs and remove this plan file when done.
