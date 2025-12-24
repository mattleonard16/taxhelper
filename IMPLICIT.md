/# IMPLICIT.md (Repo-Wide Execution Contract)

This file defines global rules for any orchestrated, multi-agent workflow in this repository.
All skill files and agent files must comply with this contract.

## Project Structure

```
taxhelper/
├── src/
│   ├── app/
│   │   ├── (app)/                  # Authenticated routes
│   │   │   ├── dashboard/          # Main dashboard with tax stats
│   │   │   ├── transactions/       # Transaction list & forms
│   │   │   ├── insights/           # AI-powered insights page
│   │   │   ├── deductions/         # Deduction tracking
│   │   │   ├── templates/          # Tax templates
│   │   │   ├── recurring/          # Recurring transactions
│   │   │   ├── reports/            # Tax reports
│   │   │   └── settings/           # User settings
│   │   ├── api/
│   │   │   ├── auth/               # NextAuth handlers
│   │   │   ├── transactions/       # CRUD for transactions
│   │   │   ├── receipts/           # Receipt upload, processing, stats
│   │   │   ├── insights/           # AI insights endpoints
│   │   │   ├── templates/          # Template CRUD
│   │   │   ├── summary/            # Aggregated tax data
│   │   │   └── settings/           # User settings API
│   │   └── auth/                   # Public auth pages (signin, signup)
│   ├── components/
│   │   ├── dashboard/              # Dashboard cards, charts
│   │   ├── transactions/           # Transaction list, form
│   │   ├── insights/               # Insight cards
│   │   └── ui/                     # shadcn/ui components
│   ├── lib/
│   │   ├── prisma.ts               # Prisma client
│   │   ├── auth.ts                 # NextAuth config
│   │   ├── format.ts               # Formatting utilities
│   │   ├── receipt/                # Receipt processing (OCR, LLM, storage)
│   │   ├── llm/                    # LLM service layer (GPT-4)
│   │   └── insights/               # Insight generators & cache
│   ├── hooks/                      # React hooks
│   └── types/                      # TypeScript types
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/                 # Migration history
├── testagents/
│   └── skills/
│       └── taxhelper-receipt-orchestration/
│           ├── TRUE_GUIDE.md       # Canonical skill contracts
│           ├── orchestrator.md     # Orchestrator instructions
│           ├── agents/             # Phase agent definitions
│           ├── references/         # Implementation guides
│           └── outputs/            # Session output directories
├── docs/                           # CLI prompts & documentation
├── scripts/                        # Utility scripts
├── e2e/                            # Playwright E2E tests
├── public/                         # Static assets
├── AGENTS.md                       # Agent guidelines & project rules
├── README.md                       # Project documentation
└── IMPLICIT.md                     # This file
```

## Objectives
- Produce deterministic, auditable outputs for multi-step workflows.
- Minimize context growth by passing file paths + short summaries between agents.
- Make re-runs cheap: rerun a single phase without redoing earlier phases.

## Non-Negotiables
1. Artifact-first: every phase writes a report file to disk.
2. Path-first: agents pass file paths + compact summaries, never large raw payloads in chat.
3. Strict JSON returns: each agent returns ONLY a JSON object per its phase contract.
4. Orchestrator owns state: only orchestrator updates manifest and controls DB writes.
5. Safe-by-default: never persist to production tables until verification passes.

## Standard Session Layout
Every orchestration run creates a session directory:
```
testagents/skills/<skill>/outputs/<timestamp>_<run_id>/
  ├── 00-manifest.json
  ├── 01-*.md
  ├── 02-*.json
  ├── 03-*.json
  ├── 04-*.md + 04-*.json
  ├── 05-*.md + 05-*.json
  └── logs/
```

## Manifest Contract (required)
00-manifest.json must always include:
- run_id, created_at
- inputs (source paths, user_id/org_id where applicable)
- reports: phase->absolute paths
- summaries: phase->short summary strings or small objects
- revised_action_items: array
- status: in_progress | complete | needs_review | partial | failed
- errors: array (optional)

## Error Handling Rules
- Agents never "handle" errors by guessing; they must report missing inputs explicitly.
- Orchestrator marks manifest status=failed and records error details if any phase fails validation.
- Re-runs:
  - If an output file already exists and inputs are unchanged, orchestrator may reuse it.
  - If inputs changed, orchestrator must invalidate downstream phases.

## Security / PII
- Do not write raw sensitive data into Markdown reports. Prefer hashes/redactions.
- If receipts include card numbers or addresses, redact before writing artifacts.

## Agent Output Validation
Orchestrator must validate:
- status == "complete"
- report_path exists, absolute, and is under session_dir
- required summary object exists and is non-empty
- JSON is parseable, no extra text

## Writing Style for Reports
- Use headings, bullets, and short paragraphs.
- Always include: Observations, Decisions, Evidence, Risks, Next steps.
