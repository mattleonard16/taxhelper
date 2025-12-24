# Phase 4 — Verification

This file inherits TRUE_GUIDE.md and IMPLICIT.md. Do not restate global rules.

## When to Activate
Activate this agent when:
- Phase 3 (Normalization) completed successfully
- Normalized data is available in 03-normalized.json
- Need to validate transaction data before posting
- Re-running verification after rule changes or manual edits

## Purpose
Validate normalized data: run integrity checks, detect duplicates, assess confidence, and produce action items.


## Inputs
- session_dir: absolute path to session output directory
- intake_path: absolute path to 01-intake.md
- extraction_path: absolute path to 02-raw-extraction.json
- normalization_path: absolute path to 03-normalized.json

## Steps
1. Load all prior phase outputs
2. Run validation checks (see Check Details below)
3. Run dedupe analysis:
   - Always generate local dedupe keys: `hash(merchant_canonical + amount + currency + date_bucket + last4_if_present)`
   - If DB access available, augment with DB lookup
   - Set `dedupe_mode`: `local_only` or `with_db`
4. Assess overall confidence:
   - Aggregate check results
   - Determine verdict based on failures and confidence
5. Generate revised action items (human-readable, ordered by priority)
6. Write BOTH artifacts:
   - `04-verification.json` (machine-readable, used by Phase 5)
   - `04-verification.md` (human-readable report)

## Check Details

### Totals Check
- Rule: `subtotal + tax + tip = total` (±$0.02 tolerance)
- Output evidence: `computed_subtotal`, `extracted_subtotal`, `delta`, `tolerance`

### Tax Check
- Rule: `tax / subtotal` in reasonable range
- SOFT WARNING unless jurisdiction known (VAT, tax-exempt, alcohol, etc.)
- Default: warn if >25%, pass otherwise
- Output evidence: `tax_amount`, `subtotal`, `computed_rate`, `threshold`

### Date Check
- Rule: date not in future, not older than 7 years
- Output evidence: `extracted_date`, `current_date`, `age_days`

### Merchant Check
- Rule: canonical merchant is non-empty string
- Output evidence: `canonical_merchant`, `raw_merchant`

### Category Check
- Rule: category confidence >= 0.7
- Output evidence: `category_name`, `confidence`, `threshold`

## Verdict Determination
| Condition | Verdict |
|-----------|---------|
| All checks PASS, confidence >= 0.8 | `OK_TO_POST` |
| 0-1 WARN checks, no FAIL, confidence >= 0.7 | `NEEDS_REVIEW` |
| Any FAIL check | `FAILED` |
| 2+ WARN checks | `NEEDS_REVIEW` |
| Confidence < 0.7 | `NEEDS_REVIEW` |

## Write Artifacts
- Must write: `{session_dir}/04-verification.json` (machine-readable)
- Must write: `{session_dir}/04-verification.md` (human-readable)

> [!IMPORTANT]
> Paths in returned JSON MUST be absolute. Construct by concatenating session_dir + filename.
> Example: If session_dir is `/home/user/outputs/20240115_abc123/`, return `/home/user/outputs/20240115_abc123/04-verification.json`

### 04-verification.json Schema
```json
{
  "verification_version": "2.0",
  "verified_at": "<ISO timestamp>",
  "inputs_analyzed": {
    "intake": "/absolute/path/01-intake.md",
    "extraction": "/absolute/path/02-raw-extraction.json",
    "normalization": "/absolute/path/03-normalized.json"
  },
  "verdict": "OK_TO_POST | NEEDS_REVIEW | FAILED",
  "check_results": [
    {
      "check": "totals",
      "status": "PASS | WARN | FAIL",
      "details": "Line items sum matches total within tolerance",
      "evidence": {
        "computed_value": 45.67,
        "extracted_value": 45.65,
        "delta": 0.02,
        "tolerance": 0.02
      }
    },
    {
      "check": "tax",
      "status": "WARN",
      "details": "Tax rate 22% is high but may be valid for jurisdiction",
      "evidence": {
        "tax_amount": 8.50,
        "subtotal": 38.64,
        "computed_rate": 0.22,
        "threshold": 0.25
      }
    }
  ],
  "dedupe_analysis": {
    "mode": "local_only | with_db",
    "dedupe_keys": ["hash1", "hash2"],
    "duplicates_found": 0,
    "duplicate_details": []
  },
  "overall_confidence": 0.85,
  "revised_action_items": [
    "[MEDIUM] Review tax rate - 22% is unusually high",
    "[LOW] Verify merchant name spelling"
  ]
}
```

### 04-verification.md Template
```markdown
# Verification Report

## Files Analyzed
- Intake: {absolute_intake_path}
- Extraction: {absolute_extraction_path}
- Normalization: {absolute_normalization_path}

## Validation Checks

### Totals Check
- Status: PASS/WARN/FAIL
- Details: {explanation}
- Evidence: computed={value}, extracted={value}, delta={value}

### Tax Check
- Status: PASS/WARN/FAIL
- Details: {explanation}
- Evidence: rate={value}, threshold={value}

### Date Check
- Status: PASS/WARN/FAIL
- Details: {explanation}

### Merchant Check
- Status: PASS/WARN/FAIL
- Details: {explanation}

### Category Check
- Status: PASS/WARN/FAIL
- Details: {explanation}
- Evidence: confidence={value}, threshold=0.7

## Dedupe Analysis
- Mode: {local_only | with_db}
- Dedupe keys: {list}
- Potential duplicates found: {count}
- Details: {list if any}

## Category Confidence Rationale
{explanation of why category was assigned}

## Final Verdict
**{OK_TO_POST | NEEDS_REVIEW | FAILED}**

Reason: {explanation}

## Revised Action Items
1. {action item 1}
2. {action item 2}
```

## Return JSON (ONLY)
```json
{
  "status": "complete",
  "report_path": "/absolute/path/to/04-verification.json",
  "markdown_path": "/absolute/path/to/04-verification.md",
  "cache_key": "sha256_of_normalized_sha256_plus_agent_version",
  "verdict": "OK_TO_POST",
  "verification_summary": {
    "check_results": [
      {"check": "totals", "status": "PASS", "details": "...", "evidence": {...}},
      {"check": "tax", "status": "WARN", "details": "...", "evidence": {...}},
      {"check": "date", "status": "PASS", "details": "...", "evidence": {...}},
      {"check": "merchant", "status": "PASS", "details": "...", "evidence": {...}},
      {"check": "category", "status": "PASS", "details": "...", "evidence": {...}}
    ],
    "checks_failed": [],
    "dedupe_mode": "local_only",
    "dedupe_keys": ["hash1"],
    "conclusions_confirmed": ["merchant_valid", "date_valid", "totals_valid"],
    "conclusions_revised": [],
    "unexpected_findings": [],
    "revised_action_items": ["[MEDIUM] Review tax rate - unusually high"]
  }
}
```

> [!IMPORTANT]
> The `verdict` field is REQUIRED at the top level.
> Orchestrator gates Phase 5 execution on this field.
> Do NOT rely on Markdown parsing for verdict determination.
