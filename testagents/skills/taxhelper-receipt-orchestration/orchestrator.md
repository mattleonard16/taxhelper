# Orchestrator — TaxHelper Receipt Orchestration

This is the main skill entry point. It inherits TRUE_GUIDE.md and IMPLICIT.md.

## Purpose
Coordinate the 5-phase receipt ingestion workflow, managing session state, spawning phase agents, validating outputs, and updating the manifest.

## Inputs
```json
{
  "run_id": "string",
  "reuse_policy": "always | never | if_unchanged",
  "inputs": {
    "source_path": "absolute path to document or directory",
    "user_id": "string",
    "org_id": "string (optional)",
    "timezone": "string (e.g., America/Los_Angeles)",
    "category_rules_path": "absolute path (optional)",
    "notes": "string (optional)"
  }
}
```

## Orchestration Steps

### Step 1: Initialize Session
1. Generate timestamp: `YYYYMMDD_HHMMSS`
2. Create session_dir: `testagents/skills/taxhelper-receipt-orchestration/outputs/{timestamp}_{run_id}/`
3. Create subdirectory: `{session_dir}/logs/`
4. Write initial `00-manifest.json`:
```json
{
  "run_id": "<run_id>",
  "created_at": "<ISO timestamp>",
  "reuse_policy": "<from input, default: never>",
  "inputs": { ... },
  "reports": {},
  "summaries": {},
  "cache_keys": {},
  "reuse_decisions": [],
  "revised_action_items": [],
  "status": "in_progress",
  "errors": []
}
```

### Step 2: Execute Phases in Order
For each phase (1 through 5):
1. Check reuse policy before spawning:
   - If `reuse_policy == "always"` and artifact exists, reuse
   - If `reuse_policy == "if_unchanged"` and cache_key matches, reuse
   - Otherwise, spawn agent
2. Record reuse decision in manifest `reuse_decisions[]`
3. Spawn the phase agent with appropriate inputs (including absolute session_dir)
4. Receive JSON response from agent
5. Validate response (see validation rules below)
6. If validation fails:
   - Log structured error to `{session_dir}/logs/orchestrator.jsonl`
   - Set `manifest.status = "failed"`
   - Record error in `manifest.errors[]`
   - Stop execution (do not proceed to next phase)
7. If validation passes:
   - Update `manifest.reports[phase_key] = report_path`
   - Update `manifest.summaries[phase_key] = summary_object`
   - Update `manifest.cache_keys[phase_key] = cache_key` (if provided)
   - Write updated manifest to disk
   - Log success to `{session_dir}/logs/orchestrator.jsonl`

### Validation Rules
For each phase response, validate:
- `status == "complete"`
- `report_path` is an absolute path (starts with `/`)
- `report_path` is under `session_dir`
- Summary object exists and is non-empty
- JSON is valid (no extra text)

### Manifest Key Mapping (Canonical)
Use these consistent keys throughout:
| Phase | Manifest Key |
|-------|-------------|
| Phase 1 | `intake` |
| Phase 2 | `extraction` |
| Phase 3 | `normalization` |
| Phase 4 | `verification` |
| Phase 5 | `posting_plan` |

### Step 3: Phase Agent Invocations

#### Phase 1: Intake
- Agent: `agents/phase-1-intake.md`
- Input: `source_path`, `session_dir` (absolute)
- Output: `01-intake.md`, intake_summary

#### Phase 2: Extraction
- Agent: `agents/phase-2-extraction.md`
- Input: `session_dir`, `manifest.reports.intake`
- Cache key: `sha256(doc_sha256 + extraction_engine_version)`
- Output: `02-raw-extraction.json`, structure_summary

#### Phase 3: Normalization
- Agent: `agents/phase-3-normalization.md`
- Input: `session_dir`, `manifest.reports.extraction`, `category_rules_path`
- Cache key: `sha256(doc_sha256 + category_rules_hash + normalization_agent_version)`
- Output: `03-normalized.json`, normalization_summary

#### Phase 4: Verification
- Agent: `agents/phase-4-verification.md`
- Input: `session_dir`, all prior reports
- Cache key: `sha256(normalized_sha256 + verification_agent_version)`
- Output: `04-verification.json`, `04-verification.md`, verification_summary
- **CRITICAL**: Extract `verdict` field from JSON response

#### Phase 5: Posting Plan (Conditional)
- Agent: `agents/phase-5-posting-plan.md`
- Input: `session_dir`, `manifest.reports.verification` (JSON), `user_id`, `org_id`
- Output: `05-posting-plan.md`, `05-db-write-payload.json`, plan_summary
- **CONDITION**: Only run if Phase 4 `verdict == "OK_TO_POST"`
- If verdict is `NEEDS_REVIEW`: set manifest status to `needs_review`, skip Phase 5
- If verdict is `FAILED`: set manifest status to `failed`, skip Phase 5

### Step 4: Finalize
1. Set `manifest.status = "complete"` (or `needs_review` / `failed` based on verdict)
2. Write final manifest
3. Log completion to `{session_dir}/logs/orchestrator.jsonl`
4. Return final JSON

## Return JSON (ONLY)
```json
{
  "status": "complete",
  "session_dir": "/absolute/path/to/session",
  "reports": {
    "intake": "/absolute/path/01-intake.md",
    "extraction": "/absolute/path/02-raw-extraction.json",
    "normalization": "/absolute/path/03-normalized.json",
    "verification": "/absolute/path/04-verification.json",
    "posting_plan": "/absolute/path/05-posting-plan.md"
  },
  "final_summary": {
    "documents_processed": 1,
    "transactions_ready": 1,
    "action_items": ["item1", "item2"],
    "verdict": "OK_TO_POST"
  },
  "next_steps": [
    "Review 04-verification.md for details",
    "Execute posting plan if approved"
  ]
}
```

> [!IMPORTANT]
> `documents_processed` and `transactions_ready` MUST be integers, not strings.
> `verdict` MUST be one of: `OK_TO_POST`, `NEEDS_REVIEW`, `FAILED`.

## Error Handling
- If any phase fails validation, immediately:
  - Log structured error: `{"timestamp": "ISO", "phase": "...", "event": "failed", "details": {...}}`
  - Update manifest with error details
  - Set status to "failed"
  - Return error JSON with phase that failed and reason
- Never guess or auto-fix agent errors

## Structured Logging
Write JSON lines to `{session_dir}/logs/orchestrator.jsonl`:
```json
{"timestamp": "2024-01-15T10:30:00Z", "phase": "intake", "event": "started", "details": {}}
{"timestamp": "2024-01-15T10:30:05Z", "phase": "intake", "event": "completed", "details": {"report_path": "/..."}}
{"timestamp": "2024-01-15T10:30:10Z", "phase": "verification", "event": "verdict", "details": {"verdict": "OK_TO_POST"}}
```

## Re-run Support
- `reuse_policy` input controls behavior:
  - `always`: reuse any existing artifact without checking cache key
  - `never`: always re-run all phases (default)
  - `if_unchanged`: check cache_key against stored value, reuse if match
- Record all reuse decisions in manifest:
```json
{
  "phase": "extraction",
  "reused": true,
  "reason": "cache_key_match",
  "cache_key": "abc123..."
}
```
