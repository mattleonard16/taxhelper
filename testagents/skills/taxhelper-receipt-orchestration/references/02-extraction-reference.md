# Extraction Reference Guide

Quick reference for Phase 2 (Extraction) implementation.

## OCR Engine Recommendations
- Primary: Tesseract.js (already in project)
- Fallback: Cloud Vision API (if Tesseract fails)
- Settings: English language, auto-orientation

## Standard Fields to Extract

### Required Fields (use `_raw` suffix)
| Field | Regex Hints | Notes |
|-------|-------------|-------|
| merchant_name_raw | First large text, or text after "From:" | Usually at top |
| total | `(?:total|amount due|grand total)[:\s]*\$?([\d,]+\.?\d*)` | Look for largest amount |
| transaction_date_raw | `\d{1,2}[/-]\d{1,2}[/-]\d{2,4}` | Multiple formats possible |

> **Note**: Fields are named with `_raw` suffix in extraction phase because they contain unprocessed OCR output. Normalization (Phase 3) converts these to clean canonical values.

### Optional Fields
| Field | Regex Hints |
|-------|-------------|
| subtotal | `(?:subtotal|sub-total)[:\s]*\$?([\d,]+\.?\d*)` |
| tax | `(?:tax|hst|gst|vat)[:\s]*\$?([\d,]+\.?\d*)` |
| tip | `(?:tip|gratuity)[:\s]*\$?([\d,]+\.?\d*)` |
| payment_method | `(?:visa|mastercard|amex|cash|debit)` |

## Line Item Detection
- Look for tabular structure with columns
- Common patterns:
  - `{qty} x {description} ${price}`
  - `{description}    ${price}`
  - `{description} ... ${price}`

## Confidence Scoring
- High (0.9+): Clear text, standard format, all fields found
- Medium (0.7-0.9): Some fields inferred, minor OCR errors
- Low (<0.7): Poor image quality, handwritten, unusual format

## Common Parsing Warnings
- "Date format ambiguous (MM/DD vs DD/MM)"
- "Multiple totals found, using largest"
- "Tax amount seems high (>15%)"
- "Currency symbol not found, assuming USD"
- "Handwritten text detected, low confidence"

## Raw Text Storage
- Store first 200 characters only in `raw_text_excerpt`
- Full OCR text goes to separate file if needed
- Redact any visible card numbers (show last 4 only)
