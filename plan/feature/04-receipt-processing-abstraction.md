# Feature Plan: Receipt Processing Abstraction

Context
- Sync/async receipt handling is spread across upload API and worker.
- Goal: shared service to keep behavior consistent and testable.

Checklist
- [ ] Define a receipt processing service interface in `src/lib/receipt/`.
- [ ] Move shared extraction + error mapping logic into the service.
- [ ] Update upload API and worker to use the service.
- [ ] Add tests covering sync + async flows.
- [ ] Update docs and remove this plan file when done.
