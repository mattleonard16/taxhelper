# Phase 2 — Extraction

This file inherits TRUE_GUIDE.md and IMPLICIT.md. Do not restate global rules.

## When to Activate
Activate this agent when:
- Phase 1 (Intake) completed successfully
- Document inventory is available in intake report
- Need to extract structured fields from receipts
- Re-running extraction after OCR engine or parsing logic changes

## Purpose
Extract structured fields from receipt documents using OCR and parsing logic.

## Inputs
- session_dir: absolute path to session output directory
- intake_report_path: absolute path to 01-intake.md
- document_pointers: list of document paths from intake phase

## Steps
1. Read intake report to get document inventory
2. For each document:
   - Perform OCR (if image/scanned PDF)
   - Parse text to extract structured fields
   - Identify line items if present
3. Extract standard fields:
   - merchant_name (raw)
   - transaction_date (raw format)
   - subtotal, tax, tip, total
   - payment_method
   - line_items[] (if present)
4. Record confidence notes for uncertain extractions
5. Note any missing required fields
6. Log parsing warnings (e.g., "date format ambiguous")
7. Write structured output to `02-raw-extraction.json`

## Write Artifact
- Must write: `{session_dir}/02-raw-extraction.json`

> [!IMPORTANT]
> Return absolute paths only. Construct by concatenating session_dir + filename.

### 02-raw-extraction.json Schema
```json
{
  "extraction_version": "1.0",
  "extracted_at": "<ISO timestamp>",
  "documents": [
    {
      "document_id": "<from intake>",
      "fields": {
        "merchant_name_raw": "<string>",
        "transaction_date_raw": "<string>",
        "subtotal": null,
        "tax": null,
        "tip": null,
        "total": null,
        "payment_method": null,
        "currency": "USD"
      },
      "line_items": [
        {
          "description": "<string>",
          "quantity": 1,
          "unit_price": null,
          "total": null
        }
      ],
      "raw_text_excerpt": "<first 200 chars for debugging>",
      "confidence": 0.85,
      "warnings": []
    }
  ]
}
```

## Error Recovery

| Error Code | Cause | Resolution |
|------------|-------|------------|
| INTAKE_NOT_FOUND | intake_report_path does not exist | Verify Phase 1 completed, check manifest for correct path |
| OCR_FAILED | Tesseract/OCR engine failed | Check image quality, try preprocessing (contrast, rotation), retry |
| LOW_CONFIDENCE | OCR confidence < 0.5 | Flag for manual review, include raw_text_excerpt for debugging |
| NO_TOTAL_FOUND | Could not extract total amount | Check if receipt is partial, flag for manual entry |
| DATE_AMBIGUOUS | Multiple date formats detected (MM/DD vs DD/MM) | Record both interpretations in warnings, use US format as default |
| CORRUPTED_PDF | PDF cannot be parsed | Try converting to image first, or flag as unreadable |

Error messages must enable recovery. Include the document_id and specific field that failed.

## Return JSON (ONLY)
```json
{
  "status": "complete",
  "report_path": "/absolute/path/to/session/02-raw-extraction.json",
  "cache_key": "sha256_of_doc_sha256_plus_extraction_engine_v1",
  "structure_summary": {
    "documents_processed": 1,
    "extracted_fields": ["merchant_name", "date", "total"],
    "line_items_present": true,
    "confidence_notes": ["date format inferred as MM/DD/YYYY"],
    "missing_fields": ["tax"],
    "parsing_warnings": []
  }
}
```

> [!IMPORTANT]
> `report_path` MUST be an absolute path (starts with `/`).
> `documents_processed` MUST be an integer.
