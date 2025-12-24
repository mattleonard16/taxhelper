# Agent Guidelines

## Commands
- `npm run dev` - Start dev server on :3000
- `npm run build` - Production build (runs `prisma generate` first)
- `npm run lint` - ESLint (zero errors required)
- `npm test` - Run all Vitest tests
- `npm test -- src/lib/insights/__tests__/spike-detector.test.ts` - Run single test file
- `npm test -- -t "test name"` - Run tests matching pattern
- `npm run test:e2e` - Playwright e2e tests
- `npx prisma migrate dev` - Apply migrations; `npx prisma validate` to check schema

## Code Style
- TypeScript strict mode; use `@/*` path alias for imports
- Components: PascalCase files; routes: lowercase/kebab-case folders under `src/app`
- Tailwind + shadcn/ui (`components/ui`); prefer existing primitives
- Centralize utilities in `src/lib`; keep tests in `__tests__/` folders near features
- Error handling: use try/catch with typed errors; API routes return `{ error: string }` on failure
- Never commit secrets; use `.env.local` for `DATABASE_URL`, `NEXTAUTH_*`, API keys

## Structure
- `src/app/(app)/` - Authenticated routes (dashboard, transactions, insights, etc.)
- `src/app/api/` - API routes; `src/app/auth/` - Public auth pages
- `src/lib/` - Prisma client, auth config, insights generators, receipt processing
- `prisma/schema.prisma` - Database schema; migrations in `prisma/migrations/`
