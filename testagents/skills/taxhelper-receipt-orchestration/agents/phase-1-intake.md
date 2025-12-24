# Phase 1 — Intake

This file inherits TRUE_GUIDE.md and IMPLICIT.md. Do not restate global rules.

## When to Activate
Activate this agent when:
- Starting a new receipt ingestion workflow
- Processing new documents (PDF, image, or email)
- Re-running intake after source files have changed
- Orchestrator has initialized session_dir and manifest

## Purpose
Analyze input documents, generate metadata, compute hashes, and prepare storage pointers for downstream phases.

## Inputs
- source_path: absolute path to document (pdf/image/eml) or directory
- session_dir: absolute path to session output directory

## Steps
1. Validate source_path exists
2. If directory, enumerate all supported files (pdf, png, jpg, jpeg, gif, webp, heic, eml, msg)
3. For each document:
   - Generate unique document_id (UUID v4)
   - Detect file type from extension and magic bytes
   - Count pages (for PDF) or set to 1 (for images)
   - Compute SHA256 hash
4. Record storage location (local path for now)
5. Identify any assumptions made (e.g., "assumed single receipt per image")
6. Note any open questions (e.g., "multiple receipts detected in single PDF")
7. Write report to `01-intake.md`

## Write Artifact
- Must write: `{session_dir}/01-intake.md`

> [!IMPORTANT]
> Return absolute paths only. Construct by concatenating session_dir + filename.
> Example: `/Users/user/outputs/20240115_abc123/01-intake.md`

### 01-intake.md Template
```markdown
# Intake Report

## Inputs
- Source: {source_path}
- Session: {session_dir}
- Processed at: {timestamp}

## Document Inventory
| Document ID | Original Name | Type | Pages | SHA256 |
|-------------|---------------|------|-------|--------|
| {id} | {name} | {type} | {pages} | {hash} |

## Storage Pointers
- Location: {storage_location}
- Access method: {method}

## Risks / Issues
- {list any issues}

## Next Step Handoff
Phase 2 should read: {list of document paths with their IDs}
```

## Error Recovery

| Error Code | Cause | Resolution |
|------------|-------|------------|
| SOURCE_NOT_FOUND | source_path does not exist | Verify path spelling, check file permissions, confirm file was not moved |
| UNSUPPORTED_TYPE | File extension not in [pdf, png, jpg, jpeg, gif, webp, heic, eml] | Convert to supported format or skip with warning |
| READ_PERMISSION | Cannot read source file | Check file permissions, run as user with read access |
| HASH_FAILED | Unable to compute SHA256 | File may be corrupted or locked; retry or skip with warning |
| EMPTY_DIRECTORY | source_path is directory with no supported files | Verify correct directory, check for nested subdirectories |

Error messages must be actionable. Include the specific path or value that caused the error.

## Return JSON (ONLY)
```json
{
  "status": "complete",
  "report_path": "/absolute/path/to/session/01-intake.md",
  "cache_key": "sha256_of_source_path_contents",
  "intake_summary": {
    "document_count": 1,
    "documents": [
      {
        "document_id": "550e8400-e29b-41d4-a716-446655440000",
        "original_name": "receipt.pdf",
        "detected_type": "pdf",
        "pages": 1,
        "sha256": "a1b2c3d4..."
      }
    ],
    "storage": {
      "location": "local",
      "pointers": ["/absolute/path/to/receipt.pdf"]
    },
    "assumptions": ["assumed single receipt per image"],
    "open_questions": []
  }
}
```

> [!IMPORTANT]
> `report_path` MUST be an absolute path (starts with `/`), not a template placeholder.
> `document_count` MUST be an integer, not a string.
