# Task 03 — Fix `/api/export` Contract (UI ↔ API Alignment)

## Description

The UI calls `/api/export?format=csv&ids=...` (selected transaction export), but the API (`src/app/api/export/route.ts`) expects `year` and returns a ZIP. Decide on the intended UX and align the contract.

Two viable directions:

1. **Keep year-based ZIP**: change UI to request by year and download ZIP; optionally add a separate “Export selected” endpoint.
2. **Support selected IDs**: expand `/api/export` to accept `ids` + `format`, and keep `year` ZIP export as a separate route.

Also address ZIP contents: `src/lib/export/zip-creator.ts` only embeds receipts if bytes are loaded; current API passes only paths.

## Files / Modules Affected

- `src/app/api/export/route.ts`
- `src/lib/export/*` (`csv-generator.ts`, `folder-organizer.ts`, `zip-creator.ts`)
- `src/components/transactions/bulk-actions-bar.tsx`
- `src/components/transactions/transaction-list.tsx` / pages that expose export
- Tests:
  - `src/app/api/__tests__/export.test.ts`
  - Potentially add UI/unit tests for the chosen contract

## Dependencies

- Task 01

## Acceptance Criteria

- [ ] UI export works end-to-end with a single documented contract
- [ ] API returns the correct `Content-Type` and `Content-Disposition` for downloads
- [ ] Existing API tests are updated to match the intended behavior
- [ ] If exporting receipts, ZIP includes receipt files (not just folders) or explicitly documents why receipts are omitted

## Complexity

High

