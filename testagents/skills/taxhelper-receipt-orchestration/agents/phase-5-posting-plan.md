# Phase 5 — Posting Plan

This file inherits TRUE_GUIDE.md and IMPLICIT.md. Do not restate global rules.

## Purpose
Generate the database write payload and reconciliation plan. Does NOT execute writes.

## Inputs
- session_dir: absolute path to session output directory
- normalization_path: absolute path to 03-normalized.json
- verification_path: absolute path to 04-verification.json (NOT .md — read machine-readable JSON)
- user_id: string
- org_id: string (optional)
- run_id: string

## Steps
1. Load normalized data from `03-normalized.json`
2. Load verification results from `04-verification.json` (NOT Markdown)
3. Confirm `verdict == "OK_TO_POST"` from verification JSON
4. For each document, construct self-contained DB payload:
   - Pre-generate UUID for transaction record
   - Pre-generate UUID for receipt record
   - Use transaction UUID as `receipts.transaction_id`
   - Generate `idempotency_key` from dedupe_key for upsert support
5. Generate validation queries (queries to run after insert)
6. Define rollback strategy (DELETE statements with WHERE clauses)
7. Document assumptions about schema
8. Note any risks and mitigations
9. Write posting plan to `05-posting-plan.md`
10. Write DB payload to `05-db-write-payload.json`

## Write Artifacts
- Must write: `{session_dir}/05-posting-plan.md`
- Must write: `{session_dir}/05-db-write-payload.json`

> [!IMPORTANT]
> All paths in returned JSON MUST be absolute.
> Construct by concatenating session_dir + filename.

### 05-db-write-payload.json Schema
> [!IMPORTANT]
> Pre-generate ALL UUIDs so the payload is self-contained and idempotent.
> Use `idempotency_key` derived from dedupe_key for upsert semantics.

```json
{
  "payload_version": "2.0",
  "generated_at": "<ISO timestamp>",
  "run_id": "<run_id>",
  "execution_mode": "UPSERT",
  "operations": [
    {
      "table": "transactions",
      "operation": "UPSERT",
      "upsert_key": ["user_id", "idempotency_key"],
      "records": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "user_id": "<user_id>",
          "org_id": "<org_id or null>",
          "idempotency_key": "<dedupe_key_hash>",
          "merchant": "<canonical_merchant>",
          "amount": 45.67,
          "currency": "USD",
          "transaction_date": "2024-01-15",
          "category_code": "<code>",
          "is_deductible": false,
          "deduction_percentage": 100,
          "receipt_id": "660e8400-e29b-41d4-a716-446655440001",
          "run_id": "<run_id>",
          "notes": null,
          "created_at": "<ISO timestamp>",
          "updated_at": "<ISO timestamp>"
        }
      ]
    },
    {
      "table": "receipts",
      "operation": "INSERT",
      "records": [
        {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
          "storage_path": "/absolute/path/to/receipt.pdf",
          "sha256": "<hash_from_intake>",
          "original_filename": "receipt.pdf",
          "mime_type": "application/pdf",
          "file_size_bytes": 12345,
          "ocr_text_preview": "<first 200 chars>",
          "created_at": "<ISO timestamp>"
        }
      ]
    }
  ]
}
```

### UUID Pre-generation Strategy
1. Generate transaction UUID (e.g., using UUIDv4)
2. Generate receipt UUID (e.g., using UUIDv4)
3. Set `transactions.id = transaction_uuid`
4. Set `transactions.receipt_id = receipt_uuid`
5. Set `receipts.id = receipt_uuid`
6. Set `receipts.transaction_id = transaction_uuid`

This ensures the payload is fully self-contained with no "will be assigned" placeholders.

### Idempotency Key Generation
```
idempotency_key = dedupe_key from normalization phase
               = sha256(lowercase(canonical_merchant) + "|" + date + "|" + total)
```

With `UPSERT on (user_id, idempotency_key)`:
- First run: INSERT new record
- Subsequent runs with same receipt: UPDATE existing record (no duplicates)

### 05-posting-plan.md Template
```markdown
# Posting Plan

## Proposed DB Writes

### Transactions Table
- Operation: UPSERT
- Upsert key: (user_id, idempotency_key)
- Record count: {count}
- Key fields: id, user_id, merchant, amount, date, category, idempotency_key

### Receipts Table
- Operation: INSERT
- Record count: {count}
- Key fields: id, transaction_id, storage_path, sha256

## Payload File
- Location: {absolute_path}/05-db-write-payload.json

## Assumptions
> [!WARNING]
> Verify these assumptions match your actual schema before execution.

- Table `transactions` exists with columns: id, user_id, idempotency_key, merchant, amount, ...
- Table `receipts` exists with columns: id, transaction_id, storage_path, ...
- Column `run_id` exists in transactions table
- Upsert is supported (Postgres ON CONFLICT, MySQL ON DUPLICATE KEY, etc.)

## Validation Steps
1. Query: `SELECT COUNT(*) FROM transactions WHERE run_id = '{run_id}'`
   Expected: {count}
2. Query: `SELECT SUM(amount) FROM transactions WHERE run_id = '{run_id}'`
   Expected: {total}
3. Query: `SELECT COUNT(*) FROM receipts r JOIN transactions t ON r.transaction_id = t.id WHERE t.run_id = '{run_id}'`
   Expected: {count}

## Reconciliation Notes
- Compare record count to documents_processed
- Verify no orphaned receipts (all transaction_ids valid)
- Check idempotency_key uniqueness per user

## Rollback Strategy
```sql
-- Step 1: Remove receipts (FK dependency)
DELETE FROM receipts 
WHERE transaction_id IN (
  SELECT id FROM transactions WHERE run_id = '{run_id}'
);

-- Step 2: Remove transactions
DELETE FROM transactions WHERE run_id = '{run_id}';
```

## Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| Duplicate insert | Upsert on idempotency_key prevents duplicates |
| Orphaned receipts | Pre-generated UUIDs ensure FK integrity |
| Invalid category | Validated in Phase 4 |
| Schema mismatch | Assumptions section documents expected schema |
```

## Return JSON (ONLY)
```json
{
  "status": "complete",
  "report_path": "/absolute/path/to/05-posting-plan.md",
  "payload_path": "/absolute/path/to/05-db-write-payload.json",
  "plan_summary": {
    "db_operations": [
      {"table": "transactions", "operation": "UPSERT", "record_count": 1},
      {"table": "receipts", "operation": "INSERT", "record_count": 1}
    ],
    "rollback_strategy": [
      "DELETE FROM receipts WHERE transaction_id IN (...)",
      "DELETE FROM transactions WHERE run_id = '...'"
    ],
    "validation_queries": [
      "SELECT COUNT(*) FROM transactions WHERE run_id = '...'",
      "SELECT SUM(amount) FROM transactions WHERE run_id = '...'"
    ],
    "assumptions": [
      "transactions table has idempotency_key column",
      "receipts table has transaction_id FK",
      "run_id column exists for batch tracking"
    ],
    "rollout_notes": [
      "Execute in staging first",
      "Verify record counts match expected",
      "Spot-check 2-3 records manually"
    ],
    "risks_and_mitigations": [
      {"risk": "duplicate", "mitigation": "upsert on idempotency_key"},
      {"risk": "orphaned_receipt", "mitigation": "pre-generated transaction_id"}
    ]
  }
}
```

> [!IMPORTANT]
> Read verification results from `04-verification.json`, NOT from Markdown.
> All paths in returned JSON MUST be absolute (no `{session_dir}` placeholders).
> All UUIDs MUST be pre-generated — no "will be assigned" placeholders.
