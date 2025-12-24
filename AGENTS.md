# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src`: `app` (App Router; `app/(app)` holds authenticated areas such as `dashboard`, `transactions`, `templates`), `app/api` for Next.js API routes (auth, transactions, templates, summary), and `app/auth` for public auth pages.
- UI components sit in `components` (`dashboard`, `transactions`, shared `components/ui` from shadcn/ui); providers and navigation are also there.
- Shared logic and config are in `lib` (Prisma client, NextAuth config, formatting helpers) and `types`. Static assets belong in `public`. Prisma schema and migrations live in `prisma/`.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start the Next dev server on :3000 with live reload.
- `npm run build` — production build; ensure env vars (DATABASE_URL, NEXTAUTH_*) are set.
- `npm run start` — serve the built app.
- `npm run lint` — run ESLint with the Next config.
- `npx prisma migrate dev` — create/apply migrations in development; use `npx prisma studio` for local data inspection.

## Coding Style & Naming Conventions
- TypeScript with `strict` mode; prefer typed helpers in `lib` and the `@/*` path alias.
- Components and files exporting components use PascalCase; route segment folders stay lowercase/kebab-case under `src/app`.
- Tailwind-first styling; use shadcn/ui primitives from `components/ui` before adding new patterns.
- Keep shared formatting/auth/db utilities centralized in `lib` to avoid duplication.

## Insights Module
- **Location**: `src/lib/insights/` (generators), `src/app/(app)/insights/` (page), `src/components/insights/` (UI).
- **3 Insight Types**: Quiet Leaks (recurring small purchases), Tax Drag (high tax rate merchants), Spikes (anomalies >2x average).
- **Architecture**: Pure functions in generators, thresholds in `types.ts`. Insights are persisted via Prisma models with a repository layer (`src/lib/insights/repository.ts`) and cache invalidation on transaction updates.
- **API**: `GET /api/insights?range=30` returns ranked insights; `GET /api/transactions?ids=id1,id2` for drill-down fetches.

## Receipts Async Processing
- **Schema**: `ReceiptJob` model includes `processingStartedAt` and a User relation for cascading deletes.
- **Async upload**: `POST /api/receipts/upload?async=1` persists bytes and queues a job; sync mode is the default.
- **Worker trigger**: `POST /api/receipts/process` requeues stale jobs (default 15 minutes) and processes queued work.
- **Storage**: `src/lib/receipt/receipt-storage.ts` uses local `.receipt-storage` by default; override with `RECEIPT_STORAGE_ROOT`.
- **Cron hook**: set `CRON_SECRET` and schedule `npm run cron:receipts` (optional `CRON_JOB_URL`, `RECEIPT_WORKER_LIMIT`).
- **Core files**: `src/lib/receipt/receipt-job-repository.ts`, `src/lib/receipt/receipt-job-worker.ts`.
- **Tests**: `src/lib/receipt/__tests__/receipt-storage.test.ts`, `src/lib/receipt/__tests__/receipt-job-repository.test.ts`, `src/lib/receipt/__tests__/receipt-job-worker.test.ts`, `src/app/api/__tests__/receipts-upload.test.ts` (async queueing).

## LLM-Powered Receipt Extraction
- **Integration**: Hybrid OCR + LLM fallback using GPT-4o-mini
- **Categories**: Meals, Travel, Office, Utilities, Services, Groceries, Healthcare, Other
- **Deductibility**: LLM flags potentially deductible business expenses
- **Files**: `src/lib/receipt/receipt-llm.ts` (main LLM calls), `src/lib/llm/llm-service.ts` (standalone)
- **Environment**: Requires `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` for Claude fallback)

## Testing Guidelines
- **198 tests** using Vitest + React Testing Library; run with `npm test`.
- Keep tests close to features (e.g., `src/lib/insights/__tests__/`, `src/app/api/__tests__/`).
- For data access, mock Prisma via dependency injection or a test database; keep fixtures minimal and deterministic.
- Validate schema changes by running `npx prisma migrate dev` before opening a PR; perform a manual smoke run with `npm run dev` when touching routing or auth.

## Commit & Pull Request Guidelines
- Commit messages: imperative, present tense, ideally ≤72 chars (e.g., `Add transaction filters`); group related changes per commit.
- PRs: include a concise description, screenshots for UI changes, links to issues/tasks, and call out env or migration impacts. Ensure `npm run lint` passes and migrations are checked in under `prisma/migrations`.
- Migration history: avoid deleting or rewriting migrations that may have been applied; prefer forward migrations or a documented squash plan to prevent drift/errors.

## Security & Configuration
- Use `.env.local` for secrets; never commit credentials. Required keys include `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`, plus provider creds when enabling OAuth or email.
- Rotate NextAuth secret when sharing environments and rotate database credentials on role changes or leaks.

## PWA & Mobile
- The app is a PWA with manual service worker (`public/sw.js`) and bottom navigation for mobile.
- **Real-device testing required** to verify:
  - Safe-area-inset on iOS (home indicator)
  - Touch feel and responsiveness
  - Scroll behavior with bottom nav (content not hidden)

## Agent Tool Usage Guidelines
- **NEVER use `mgrep` or `codebase_search`** when file paths are known from project structure, imports, or prior context. Use `read_file` directly.
- **ALWAYS use `grep`** for exact string, function name, or import searches—not semantic search.
- **Batch file operations**: Read multiple related files in a single tool call.
- **No redundant lookups**: Reuse information from files already read in the session.

## Safety
- **No Secrets**: Never commit API keys, tokens, or passwords.

## Improvements
When you see clear opportunities for better design, maintainability, security, or workflows:
- Implement the requested change within current constraints first.
- Add at most one or two short notes about improvement opportunities and their benefits (for example: "This logic could be refactored to a Strategy pattern for better scalability.").
- Offer to provide a more detailed migration plan or diagram only if the user requests it, instead of doing so by default.

## Programmatic Checks (Must Pass Before PR)
These commands MUST succeed before any code is considered complete:
```bash
npm run lint          # Zero errors required
npm test              # All 216+ tests must pass  
npm run build         # Production build must succeed
npx prisma validate   # Schema must be valid
```

## TODO
- [ ] **LLM Cache Cleanup Cron**: Create `/api/cron/cleanup-cache` endpoint with Vercel Cron to delete expired `ReceiptExtractionCache` rows daily.

## Recent Schema Changes
- `20251223090000_add_llm_persistence` adds `ReceiptExtractionCache` and `LLMDailyUsage` tables for Prisma-backed LLM rate limiting and caching.
- `20251222050245_add_insight_explainability` adds `Insight.explanation`, `ReceiptJob`, and receipt job indexes; includes FK to `User`.

## Key File Locations
| Purpose | Path |
|---------|------|
| Prisma schema | `prisma/schema.prisma` |
| Auth config | `src/lib/auth.ts` |
| API routes | `src/app/api/` |
| Prisma client | `src/lib/prisma.ts` |
| Component library | `src/components/ui/` |
| Insights generators | `src/lib/insights/` |
| Receipt jobs | `src/lib/receipt/receipt-job-repository.ts` |
| Receipt worker | `src/lib/receipt/receipt-job-worker.ts` |
| Receipt storage | `src/lib/receipt/receipt-storage.ts` |
| Test setup | `src/test/setup.ts` |
| Environment validation | `src/lib/env.ts` |
| Agent skills | `testagents/skills/` |

## Agent Skills (Multi-Agent Workflows)

### Location
Agent skill definitions live in `testagents/skills/`. These are specification files that define multi-agent orchestrated workflows.

### Receipt Orchestration Skill
The main agent skill in this project is the **Receipt Orchestration** workflow:

```
testagents/skills/taxhelper-receipt-orchestration/
├── TRUE_GUIDE.md          # Canonical contracts - all phases must follow this
├── orchestrator.md        # Main entry point - coordinates 5 phases
├── agents/
│   ├── phase-1-intake.md       # Document metadata, hashing, storage
│   ├── phase-2-extraction.md   # OCR, structured field parsing
│   ├── phase-3-normalization.md # Merchant mapping, categorization
│   ├── phase-4-verification.md  # Validation checks, verdicts
│   └── phase-5-posting-plan.md  # DB payload generation
├── references/            # Heuristics and checklists
├── scripts/               # Utility scripts
└── outputs/               # Session output directories
```

### How It Works
1. **Orchestrator** receives a receipt path and creates a session directory
2. **Phase agents** execute in order, each writing artifacts to disk
3. **File-based state**: Agents pass absolute file paths + summaries (not raw payloads)
4. **Verification gates posting**: Phase 5 only runs if Phase 4 verdict is `OK_TO_POST`
5. **Final payload**: `/outputs/<session>/05-db-write-payload.json` contains upsert-ready records

### Usage (for AI Agents)
Paste this prompt to trigger the workflow:
```
Execute the TaxHelper Receipt Orchestration skill.
Read: testagents/skills/taxhelper-receipt-orchestration/orchestrator.md
Input: { "run_id": "...", "inputs": { "source_path": "/path/to/receipt.pdf", "user_id": "..." } }
```

### Related Files
| Purpose | Path |
|---------|------|
| Global execution rules | `IMPLICIT.md` (repo root) |
| Skill contracts | `testagents/skills/taxhelper-receipt-orchestration/TRUE_GUIDE.md` |
| Orchestrator | `testagents/skills/taxhelper-receipt-orchestration/orchestrator.md` |
| Phase agents | `testagents/skills/taxhelper-receipt-orchestration/agents/*.md` |

