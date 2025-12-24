# Verification Reference Guide

Quick reference for Phase 4 (Verification) implementation.

## Validation Checks

### 1. Totals Check
- **Rule**: `subtotal + tax + tip = total` (±$0.02)
- **PASS**: Within tolerance
- **FAIL**: Difference > $0.02
- **Action on fail**: Flag for manual review

### 2. Tax Rate Check
- **Rule**: `tax / subtotal` should be reasonable
- **PASS**: Within expected range for jurisdiction
- **WARN**: Unusual but possible (VAT, alcohol, luxury items)
- **FAIL**: >25% (likely parsing error)

> **Note**: Tax check is a SOFT WARNING by default. Exact thresholds depend on jurisdiction.

### 3. Date Check
- **Rule**: Date is not in future, not older than 7 years
- **PASS**: Within valid range
- **FAIL**: Future date or >7 years old
- **Action on fail**: Request manual confirmation

### 4. Merchant Check
- **Rule**: Canonical merchant is non-empty string
- **PASS**: Valid merchant name
- **FAIL**: Empty or "UNKNOWN"
- **Action on fail**: Require manual entry

### 5. Category Confidence Check
- **Rule**: Category confidence >= 0.7
- **PASS**: High confidence assignment
- **WARN**: 0.5-0.7 (suggest review)
- **FAIL**: <0.5 (require manual categorization)

## Dedupe Analysis

### Exact Duplicate Detection
- Same dedupe key = exact duplicate
- Action: Skip posting, note in report

### Similar Transaction Detection
- Same merchant + same date + amount within 10%
- Action: Flag for review, list both transactions

### Cross-run Duplicate Detection
- Query existing transactions for matching keys
- Compare against last 30 days of data

## Confidence Aggregation

### Overall Confidence Formula
```
overall = min(
  extraction_confidence,
  normalization_confidence,
  category_confidence
)
```

### Verdict Determination
| Overall Confidence | Checks Status | Verdict |
|--------------------|---------------|---------|
| >= 0.8 | All PASS | `OK_TO_POST` |
| >= 0.7 | 0-1 WARN, no FAIL | `NEEDS_REVIEW` |
| < 0.7 | Any | `NEEDS_REVIEW` |
| Any | 2+ WARN | `NEEDS_REVIEW` |
| Any | 1+ FAIL | `FAILED` |

> **Note**: `NEEDS_REVIEW` allows orchestrator to optionally proceed with human approval. `FAILED` blocks posting completely.

## Action Item Generation

### Priority Order
1. **Critical**: Missing required data (merchant, date, total)
2. **High**: Failed validation checks
3. **Medium**: Low confidence assignments
4. **Low**: Suggestions for improvement

### Action Item Format
```
"[PRIORITY] Action description - Context"
```

Examples:
- "[HIGH] Verify total amount - Calculated total differs from extracted"
- "[MEDIUM] Review category assignment - Low confidence (0.65)"
- "[LOW] Consider adding line items - Line item total differs from subtotal"
