# Phase 3 — Normalization

This file inherits TRUE_GUIDE.md and IMPLICIT.md. Do not restate global rules.

## When to Activate
Activate this agent when:
- Phase 2 (Extraction) completed successfully
- Raw extraction data is available in 02-raw-extraction.json
- Need to map merchants, assign categories, or standardize dates
- Re-running after category rules have been updated

## Purpose
Normalize extracted data: map merchants to canonical names, assign categories, standardize dates and amounts.

## Inputs
- session_dir: absolute path to session output directory
- extraction_path: absolute path to 02-raw-extraction.json
- category_rules_path: absolute path to category taxonomy (optional)
- timezone: user's timezone for date interpretation

## Steps
1. Load raw extraction data
2. For each document:
   - Normalize merchant name (trim, standardize casing, map aliases)
   - Parse and standardize date to ISO format using timezone
   - Validate and normalize currency amounts
   - Apply category rules to determine:
     - Category name and code
     - Deductible flag
     - Confidence score
   - Generate dedupe keys (hash of merchant + date + total)
3. Validate line item totals sum to subtotal (within tolerance)
4. Record any normalization warnings
5. Write normalized output to `03-normalized.json`

## Write Artifact
- Must write: `{session_dir}/03-normalized.json`

> [!IMPORTANT]
> Return absolute paths only. Construct by concatenating session_dir + filename.

### 03-normalized.json Schema
```json
{
  "normalization_version": "1.0",
  "normalized_at": "<ISO timestamp>",
  "rules_version": "<hash of category_rules if used>",
  "documents": [
    {
      "document_id": "<from intake>",
      "normalized": {
        "canonical_merchant": "<standardized name>",
        "merchant_aliases_matched": [],
        "transaction_date": "<ISO date>",
        "transaction_date_source": "parsed|inferred",
        "amounts": {
          "subtotal": null,
          "tax": null,
          "tip": null,
          "total": 0.00,
          "currency": "USD"
        },
        "category": {
          "name": "<category name>",
          "code": "<category code>",
          "deductible_flag": false,
          "confidence": 0.9,
          "rule_matched": "<rule id if applicable>"
        },
        "line_items_normalized": []
      },
      "dedupe_keys": ["<hash1>"],
      "warnings": []
    }
  ]
}
```

## Error Recovery

| Error Code | Cause | Resolution |
|------------|-------|------------|
| EXTRACTION_NOT_FOUND | extraction_path does not exist | Verify Phase 2 completed, check manifest for correct path |
| INVALID_DATE | Date cannot be parsed from raw string | Flag for manual review, record raw_date in warnings |
| UNKNOWN_MERCHANT | Merchant not found in alias mappings | Use raw merchant name as canonical, set confidence=0.5 |
| CATEGORY_NOT_MATCHED | No category rule matched merchant | Assign "OTHER" category, flag for manual categorization |
| AMOUNT_MISMATCH | Line items don't sum to subtotal (>$0.05 delta) | Record delta in warnings, use extracted total as truth |
| RULES_NOT_FOUND | category_rules_path provided but file not found | Proceed without rules, assign all to "OTHER" with low confidence |

Error messages must be actionable. Include document_id, field name, and actual values.

## Return JSON (ONLY)
```json
{
  "status": "complete",
  "report_path": "/absolute/path/to/session/03-normalized.json",
  "cache_key": "sha256_of_doc_sha256_plus_rules_hash_plus_agent_v1",
  "normalization_summary": {
    "documents_processed": 1,
    "canonical_merchant": "Starbucks",
    "inferred_date": "2024-01-15",
    "inferred_total": 45.67,
    "category": {
      "name": "Meals & Entertainment",
      "code": "MEALS",
      "deductible_flag": true,
      "confidence": 0.92
    },
    "dedupe_keys": ["abc123def456"],
    "warnings": []
  }
}
```

> [!IMPORTANT]
> `report_path` MUST be an absolute path (starts with `/`).
> `documents_processed` and `inferred_total` MUST be numbers, not strings.
