# Intake Reference Guide

Quick reference for Phase 1 (Intake) implementation.

## Supported File Types
- PDF: `.pdf` (scanned or native)
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.heic`
- Email: `.eml`, `.msg`

## Document ID Generation
- Use UUID v4 for uniqueness
- Format: `8-4-4-4-12` hex characters

## SHA256 Hashing
- Read file as binary
- Compute full file hash
- Output as lowercase hex string (64 characters)

## Page Detection Heuristics
- PDF: Use PDF library to count pages
- Images: Always 1 page
- Email: Count as 1, but note if attachments exist

## Storage Format
The agent returns storage as:
```json
{
  "storage": {
    "location": "local",
    "pointers": ["/absolute/path/to/file1.pdf", "/absolute/path/to/file2.jpg"]
  }
}
```

For future cloud storage, extend with:
```json
{
  "location": "s3",
  "pointers": ["s3://bucket/key1", "s3://bucket/key2"]
}
```

## Common Assumptions to Document
- "Assumed single receipt per image"
- "Assumed PDF pages are continuous receipt"
- "Assumed email body is receipt (no attachments)"

## Open Questions to Flag
- Multiple receipts detected in single document
- Document appears to be statement, not receipt
- File is password-protected
- File is corrupted or unreadable
