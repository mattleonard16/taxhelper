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
- **Architecture**: Pure functions in generators, thresholds in `types.ts`, compute-on-demand via Prisma (no persistence yet).
- **API**: `GET /api/insights?range=30` returns ranked insights; `GET /api/transactions?ids=id1,id2` for drill-down fetches.

## Testing Guidelines
- **198 tests** using Vitest + React Testing Library; run with `npm test`.
- Keep tests close to features (e.g., `src/lib/insights/__tests__/`, `src/app/api/__tests__/`).
- For data access, mock Prisma via dependency injection or a test database; keep fixtures minimal and deterministic.
- Validate schema changes by running `npx prisma migrate dev` before opening a PR; perform a manual smoke run with `npm run dev` when touching routing or auth.

## Commit & Pull Request Guidelines
- Commit messages: imperative, present tense, ideally ≤72 chars (e.g., `Add transaction filters`); group related changes per commit.
- PRs: include a concise description, screenshots for UI changes, links to issues/tasks, and call out env or migration impacts. Ensure `npm run lint` passes and migrations are checked in under `prisma/migrations`.

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
- **Prefer direct file reads over semantic search**: When file paths are known (from project structure, imports, or previous context), use `read_file` directly instead of `mgrep` or `codebase_search`.
- **Use `grep` for exact matches**: When searching for specific strings, function names, or imports, use `grep` instead of semantic search tools.
- **Limit semantic search**: Only use `codebase_search` or `mgrep` when:
  - Exploring unfamiliar codebases
  - The exact file location is unknown
  - Understanding high-level patterns or architecture
- **Batch file reads**: When reading multiple related files, batch them in a single tool call rather than making separate calls.
- **Avoid redundant searches**: If you've already read a file or searched for something, reuse that information rather than searching again.
