# Normalization Reference Guide

Quick reference for Phase 3 (Normalization) implementation.

## Merchant Name Normalization

### Standardization Rules
1. Trim whitespace
2. Remove store numbers (e.g., "Starbucks #12345" → "Starbucks")
3. Normalize case (Title Case for display)
4. Apply alias mapping

### Common Merchant Aliases
```json
{
  "AMZN": "Amazon",
  "AMZN MKTP": "Amazon Marketplace",
  "SQ *": "Square Payment",
  "UBER   TRIP": "Uber",
  "UBER   EATS": "Uber Eats",
  "LYFT  *RIDE": "Lyft",
  "DOORDASH": "DoorDash",
  "GRUBHUB": "Grubhub"
}
```

## Date Normalization

### Input Formats to Handle
- `MM/DD/YYYY`, `MM-DD-YYYY`
- `DD/MM/YYYY`, `DD-MM-YYYY` (use locale hints)
- `YYYY-MM-DD` (ISO)
- `Month DD, YYYY` (e.g., "December 22, 2025")
- `DD Month YYYY`

### Output Format
- Always ISO 8601: `YYYY-MM-DD`
- Apply timezone conversion if time is present

### Ambiguous Date Handling
- If `M/D` vs `D/M` is ambiguous:
  - Check if day > 12 (unambiguous)
  - Use US format (MM/DD) as default
  - Flag in warnings

## Category Mapping

### Default Categories (IRS Schedule C aligned)
| Code | Name | Deductible |
|------|------|------------|
| MEALS | Meals & Entertainment | Partial (50%) |
| TRAVEL | Travel | Yes |
| SUPPLIES | Office Supplies | Yes |
| SOFTWARE | Software & Subscriptions | Yes |
| TRANSPORT | Transportation | Yes |
| UTILITIES | Utilities | Yes |
| ADVERTISING | Advertising | Yes |
| PROFESSIONAL | Professional Services | Yes |
| OTHER | Other Expenses | Depends |
| PERSONAL | Personal (Non-Deductible) | No |

### Category Inference Heuristics
- Restaurant keywords → MEALS
- Uber/Lyft → TRANSPORT
- AWS/Azure/GitHub → SOFTWARE
- Staples/Office Depot → SUPPLIES
- Hotel/Airbnb → TRAVEL

## Dedupe Key Generation

### Algorithm
```
key = sha256(lowercase(canonical_merchant) + "|" + date + "|" + total)
```

### Collision Handling
- Same key = potential duplicate
- Different key = definitely unique
- Similarity score = Levenshtein distance on merchant names

## Amount Validation
- Total should equal subtotal + tax + tip (±$0.02)
- Line items should sum to subtotal (±$0.05)
- Flag if tip > 30% of subtotal
