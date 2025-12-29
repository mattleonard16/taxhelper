# Feature Plan: Dashboard Data Hook

Context
- `src/app/(app)/dashboard/page.tsx` fetches summary, transactions, and receipt stats directly.
- Goal: centralize data fetching + error handling.

Checklist
- [ ] Define hook API shape (data, loading states, refresh, errors).
- [ ] Identify all endpoints the hook should call and required params.
- [ ] Implement `useDashboardData` in `src/hooks/`.
- [ ] Update `src/app/(app)/dashboard/page.tsx` to use the hook.
- [ ] Add tests for the hook (mock fetch).
- [ ] Update relevant documentation and remove this plan file when done.
