# Feature Plan: Reports Generation Module

Context
- `src/app/api/reports/route.ts` handles request parsing and report generation.
- Goal: extract report generation to a library for reuse and testing.

Checklist
- [ ] Define report generation inputs/outputs in `src/lib/export/`.
- [ ] Move CSV/PDF generation logic into library functions.
- [ ] Update API route to call the library.
- [ ] Add unit tests for report generation (CSV + PDF).
- [ ] Update docs and remove this plan file when done.
