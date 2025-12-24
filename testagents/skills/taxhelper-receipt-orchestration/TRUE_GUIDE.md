# TRUE_GUIDE.md (TaxHelper Receipt Orchestration)

This is the canonical truth for this skill. All phase markdown files must:
- Reference this guide
- Follow the contracts here
- Only add phase-specific deltas (do not restate global rules)

## Skill Purpose
Convert receipt documents (image/PDF/email) into verified, normalized transactions suitable for TaxHelper storage and downstream tax reporting.

## High-Level Workflow
Orchestrator runs 5 phases:
1. Intake (document metadata + storage pointer)
2. Extraction (OCR/parse into raw structured fields)
3. Normalization (merchant/category mapping + line item normalization)
4. Verification (totals checks + dedupe + confidence + revised action items)
5. Posting Plan (db payload + reconciliation notes; orchestrator performs the actual writes)

## Inputs (Skill-Level)
Required inputs payload to orchestrator:
- run_id: string
- session_dir: absolute path
- reuse_policy: "always" | "never" | "if_unchanged" (default: "never")
- inputs:
  - source_path: absolute path to document (pdf/image/eml) OR a directory containing documents
  - user_id: string
  - org_id: string (optional)
  - timezone: string (e.g., America/Los_Angeles)
  - category_rules_path: absolute path to taxonomy/rules (optional but recommended)
  - notes: string (optional)

## Output Artifacts (Skill-Level)
All outputs must be written under session_dir:
- 00-manifest.json
- 01-intake.md
- 02-raw-extraction.json
- 03-normalized.json
- 04-verification.md
- 04-verification.json (machine-readable companion)
- 05-posting-plan.md
- 05-db-write-payload.json (final rows for insert/update; does not execute writes)

## Global Path Rules
> [!IMPORTANT]
> All `report_path` values returned by agents MUST be fully resolved absolute paths.
> Do NOT use template placeholders like `{session_dir}` in returned JSON.
> Agents receive `session_dir` as input and must construct absolute paths by concatenation.

## Manifest Contract (00-manifest.json)
```json
{
  "run_id": "string",
  "created_at": "ISO timestamp",
  "reuse_policy": "always | never | if_unchanged",
  "inputs": { ... },
  "reports": {
    "intake": "/absolute/path/01-intake.md",
    "extraction": "/absolute/path/02-raw-extraction.json",
    "normalization": "/absolute/path/03-normalized.json",
    "verification": "/absolute/path/04-verification.json",
    "verification_report": "/absolute/path/04-verification.md",
    "posting_plan": "/absolute/path/05-posting-plan.md",
    "payload": "/absolute/path/05-db-write-payload.json"
  },
  "summaries": {
    "intake": { ... },
    "extraction": { ... },
    "normalization": { ... },
    "verification": { ... },
    "posting_plan": { ... }
  },
  "cache_keys": {
    "intake": "sha256(source_path_contents)",
    "extraction": "sha256(doc_sha256 + extraction_engine_version)",
    "normalization": "sha256(doc_sha256 + category_rules_hash + normalization_agent_version)",
    "verification": "sha256(normalized_sha256 + verification_agent_version)"
  },
  "reuse_decisions": [
    { "phase": "extraction", "reused": false, "reason": "cache miss" }
  ],
  "revised_action_items": [],
  "status": "in_progress | complete | needs_review | partial | failed",
  "errors": [],
  "document_results": []
}
```

## Phase Contracts (Strict JSON Returns)

### Phase 1 (Intake)
Return JSON keys:
- status: "complete"
- report_path: absolute path to 01-intake.md (MUST be absolute, no placeholders)
- cache_key: string (sha256 of source_path contents) - enables reuse if source unchanged
- intake_summary: object with:
  - document_count: integer
  - documents: [{document_id, original_name, detected_type, pages, sha256}]
  - storage: {location, pointers}
  - assumptions: []
  - open_questions: []

### Phase 2 (Extraction)
Return JSON keys:
- status: "complete"
- report_path: absolute path to 02-raw-extraction.json
- cache_key: string (sha256 of doc_sha256 + engine_version)
- structure_summary: object with:
  - extracted_fields: []
  - line_items_present: boolean
  - confidence_notes: []
  - missing_fields: []
  - parsing_warnings: []

### Phase 3 (Normalization)
Return JSON keys:
- status: "complete"
- report_path: absolute path to 03-normalized.json
- cache_key: string (sha256 of doc_sha256 + rules_hash + agent_version)
- normalization_summary: object with:
  - canonical_merchant: string
  - inferred_date: string (ISO)
  - inferred_total: number
  - category: {name, code, deductible_flag, confidence}
  - dedupe_keys: []
  - warnings: []

### Phase 4 (Verification)
Return JSON keys:
- status: "complete"
- report_path: absolute path to 04-verification.json (machine-readable)
- markdown_path: absolute path to 04-verification.md (human-readable)
- cache_key: string (sha256 of normalized_sha256 + agent_version)
- verdict: "OK_TO_POST" | "NEEDS_REVIEW" | "FAILED" (REQUIRED - orchestrator gates Phase 5 on this)
- verification_summary: object with:
  - check_results: [{check, status, details, evidence}] (structured output per check)
  - checks_failed: []
  - dedupe_mode: "local_only" | "with_db"
  - dedupe_keys: []
  - conclusions_confirmed: []
  - conclusions_revised: []
  - unexpected_findings: []
  - revised_action_items: []

#### check_results schema
Each item in `check_results[]`:
```json
{
  "check": "totals | tax | date | merchant | category",
  "status": "PASS | WARN | FAIL",
  "details": "string explanation",
  "evidence": {
    "computed_value": "...",
    "extracted_value": "...",
    "delta": "...",
    "tolerance": "...",
    "threshold": "..."
  }
}
```

### Phase 5 (Posting Plan)
Return JSON keys:
- status: "complete"
- report_path: absolute path to 05-posting-plan.md
- payload_path: absolute path to 05-db-write-payload.json
- plan_summary: object with:
  - db_operations: [{table, operation, record_count}]
  - rollback_strategy: []
  - validation_queries: []
  - rollout_notes: []
  - assumptions: [] (e.g., schema/table names, run_id column exists)
  - risks_and_mitigations: []

## Payload Contract (05-db-write-payload.json)
> [!IMPORTANT]
> Pre-generate all UUIDs so the payload is self-contained and idempotent.
> Use `idempotency_key` for upsert semantics.

```json
{
  "payload_version": "2.0",
  "generated_at": "ISO timestamp",
  "run_id": "string",
  "execution_mode": "INSERT | UPSERT",
  "operations": [
    {
      "table": "transactions",
      "operation": "UPSERT",
      "upsert_key": ["user_id", "idempotency_key"],
      "records": [
        {
          "id": "pre-generated-uuid",
          "user_id": "string",
          "idempotency_key": "dedupe_key_hash",
          "merchant": "string",
          "amount": 0.00,
          "transaction_date": "ISO date",
          ...
        }
      ]
    },
    {
      "table": "receipts",
      "operation": "INSERT",
      "records": [
        {
          "id": "pre-generated-uuid",
          "transaction_id": "same-uuid-as-above",
          ...
        }
      ]
    }
  ]
}
```

## Report Templates (Required Sections)

### 01-intake.md
- Inputs
- Document inventory
- Storage pointers
- Risks / issues
- Next step handoff (what Phase 2 should read)

### 04-verification.md
- Files analyzed (paths)
- Validation checks + results (human-readable)
- Dedupe analysis
- Category confidence rationale
- Final verdict (OK to post vs needs review)
- Revised action items (bullet list)

### 05-posting-plan.md
- Proposed DB writes (high level)
- Payload file pointer
- Assumptions (schema, table names, columns)
- Validation / reconciliation steps
- Rollback strategy

## Orchestrator Invariants
- Orchestrator creates session_dir and 00-manifest.json first.
- Orchestrator never stores large raw OCR text in Markdown.
- Orchestrator performs all validation and decides whether posting is allowed.
- Orchestrator gates Phase 5 EXCLUSIVELY on the top-level `verdict` JSON field (not `verification_summary.verdict` or Markdown).
- If verdict != "OK_TO_POST", orchestrator stops before Phase 5 or generates a "review plan" only.
- Manifest uses canonical keys: `intake`, `extraction`, `normalization`, `verification`, `posting_plan`.

## Reuse Policy & Cache Keys
- `reuse_policy` input controls behavior:
  - `always`: reuse any existing artifact without checking
  - `never`: always re-run all phases (default)
  - `if_unchanged`: reuse only if cache_key matches
- Per-phase cache keys:
  - Phase 2: `sha256(doc_sha256 + extraction_engine_version)`
  - Phase 3: `sha256(doc_sha256 + category_rules_hash + normalization_agent_version)`
  - Phase 4: `sha256(normalized_sha256 + verification_agent_version)`
- All reuse decisions recorded in manifest `reuse_decisions[]`

## Structured Logging
Logs written to `{session_dir}/logs/orchestrator.jsonl` as JSON lines:
```json
{"timestamp": "ISO", "phase": "intake", "event": "started", "details": {}}
{"timestamp": "ISO", "phase": "intake", "event": "completed", "details": {"report_path": "..."}}
{"timestamp": "ISO", "phase": "verification", "event": "failed", "details": {"error": "..."}}
```


## Implementation Note on Subagents Location
Preferred: store subagent markdown definitions under:
- testagents/skills/taxhelper-receipt-orchestration/agents/
If the runner stops detecting local agents, move them to the global agents directory without changing contracts.

## Multi-Document Behavior
When processing a directory with multiple documents:
- Each document gets its own `document_id` in the intake phase
- Extraction and normalization produce arrays of results
- `normalization_summary` in the return JSON shows the PRIMARY document (first or largest)
- Full multi-document data is in the artifact file (03-normalized.json)
- If one document fails, others may still succeed (see `partial` status)

### Document Results Tracking
For batch processing, manifest includes `document_results[]`:
```json
"document_results": [
  {"document_id": "uuid1", "status": "complete", "transaction_id": "txn-uuid1"},
  {"document_id": "uuid2", "status": "failed", "error": "OCR_FAILED", "error_details": "Image too blurry"}
]
```

## Manifest Status Definitions
| Status | Meaning |
|--------|---------|
| `in_progress` | Workflow is currently running |
| `complete` | All phases succeeded, verdict was OK_TO_POST |
| `needs_review` | Verification returned NEEDS_REVIEW verdict |
| `partial` | Some documents succeeded, others failed (batch mode) |
| `failed` | Any phase failed critically, or verification verdict was FAILED |

## Timeout & Retry Configuration
Optional inputs to orchestrator for production use:

```json
{
  "timeout_config": {
    "phase_timeouts_ms": {
      "intake": 30000,
      "extraction": 300000,
      "normalization": 60000,
      "verification": 60000,
      "posting_plan": 30000
    },
    "total_timeout_ms": 600000
  },
  "retry_policy": {
    "max_retries": 3,
    "backoff_ms": [1000, 5000, 15000],
    "retryable_errors": ["OCR_FAILED", "TIMEOUT", "RATE_LIMITED"]
  }
}
```

Default behavior (if not specified): no timeouts, no retries.

