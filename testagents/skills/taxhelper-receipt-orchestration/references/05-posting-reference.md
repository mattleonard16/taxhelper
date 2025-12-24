# Posting Reference Guide

Quick reference for Phase 5 (Posting Plan) implementation.

## Database Schema Reference

### transactions table
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT,
  merchant TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  transaction_date DATE NOT NULL,
  category_code TEXT,
  is_deductible BOOLEAN DEFAULT false,
  deduction_percentage INTEGER DEFAULT 100,
  receipt_id UUID,
  run_id TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### receipts table
```sql
CREATE TABLE receipts (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  storage_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  ocr_text_preview TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Payload Construction

### Transaction Record Template
```json
{
  "id": "<uuid v4>",
  "user_id": "<from inputs>",
  "org_id": "<from inputs or null>",
  "merchant": "<canonical_merchant>",
  "amount": 0.00,
  "currency": "USD",
  "transaction_date": "YYYY-MM-DD",
  "category_code": "<code>",
  "is_deductible": false,
  "deduction_percentage": 100,
  "receipt_id": "<receipt uuid>",
  "run_id": "<run_id>",
  "notes": null,
  "created_at": "<ISO timestamp>",
  "updated_at": "<ISO timestamp>"
}
```

### Receipt Record Template
```json
{
  "id": "<uuid v4>",
  "transaction_id": "<transaction uuid>",
  "storage_path": "<absolute path>",
  "sha256": "<from intake>",
  "original_filename": "<from intake>",
  "mime_type": "<from intake>",
  "file_size_bytes": 0,
  "ocr_text_preview": "<first 200 chars>",
  "created_at": "<ISO timestamp>"
}
```

## Validation Queries

### Post-Insert Verification
```sql
-- Count check
SELECT COUNT(*) FROM transactions WHERE run_id = '{run_id}';

-- Sum check
SELECT SUM(amount) FROM transactions WHERE run_id = '{run_id}';

-- Receipt linkage check
SELECT t.id, r.id as receipt_id 
FROM transactions t 
LEFT JOIN receipts r ON t.receipt_id = r.id 
WHERE t.run_id = '{run_id}' AND r.id IS NULL;
```

## Rollback Strategy

### Standard Rollback Order
1. Delete receipts first (foreign key dependency)
2. Delete transactions second

### Rollback Queries
```sql
-- Step 1: Remove receipts
DELETE FROM receipts 
WHERE transaction_id IN (
  SELECT id FROM transactions WHERE run_id = '{run_id}'
);

-- Step 2: Remove transactions
DELETE FROM transactions WHERE run_id = '{run_id}';
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Duplicate insert | Check dedupe keys before posting |
| Orphaned receipts | Use transaction, rollback on failure |
| Invalid category | Validate against allowed list |
| Future date | Block in verification phase |
| Negative amount | Validate amount > 0 |

## Rollout Notes
1. Execute in staging environment first
2. Verify record counts match expected
3. Spot-check 2-3 records manually
4. Run validation queries
5. If all pass, approve for production
