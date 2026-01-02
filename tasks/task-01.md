# Task 01 — Baseline: Local Env + Test/Lint/Build Green

## Description

Establish a clean baseline so future work is trustworthy:

- Ensure local environment + DB prerequisites are configured.
- Run required checks and capture any failures as follow-up tasks.

## Files / Modules Affected

- `.env` / `.env.local` (local only; do not commit secrets)
- `prisma/schema.prisma`, `prisma/migrations/*` (only if schema drift is found)
- Potentially any failing test targets

## Dependencies

- Task 00

## Acceptance Criteria

- [ ] `npx prisma validate` succeeds
- [ ] `npm run lint` succeeds (0 errors)
- [ ] `npm test` succeeds
- [ ] `npm run build` succeeds
- [ ] Any failures are recorded as new tasks with reproduction steps

## Complexity

Medium

