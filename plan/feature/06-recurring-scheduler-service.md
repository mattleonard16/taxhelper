# Feature Plan: Recurring Schedule Service

Context
- Recurring schedule calculation lives in `src/app/api/recurring/generate/route.ts`.
- Goal: isolate schedule + tax calculations into a shared service.

Checklist
- [ ] Define schedule calculation helpers in `src/lib/recurring/`.
- [ ] Move next-run and tax calculations into helpers.
- [ ] Update recurring generate route to use helpers.
- [ ] Add unit tests for date calculations and tax amounts.
- [ ] Update docs and remove this plan file when done.
