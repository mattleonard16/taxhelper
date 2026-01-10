# Feature Plan: Insights Bulk IDs API

Context
- Insights page fetches transactions by chunked IDs in the client.
- Goal: add a bulk endpoint to reduce client loops and URL length risk.

Checklist
- [ ] Add a POST endpoint for bulk transaction lookup by IDs.
- [ ] Update insights page to use the bulk endpoint.
- [ ] Keep pagination/limit safeguards for large ID lists.
- [ ] Add tests for the new endpoint and updated UI behavior.
- [ ] Update docs and remove this plan file when done.
