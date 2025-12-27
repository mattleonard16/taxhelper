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

## E2E Testing (Playwright)

### Locator Strategy
- **Prefer**: `getByTestId()`, `getByRole()`, `getByLabel()`
- **Avoid**: `getByText()` for elements that may have duplicates (causes strict mode violations)
- **Never**: `locator("table")` for virtualized lists - they use div-based rendering

### Required data-testid Hooks
Virtualized lists and bulk actions require stable test IDs:
- `data-testid="transactions-list"` - Main list container
- `data-testid="transaction-row"` - Each visible row
- `data-testid="select-all-checkbox"` - Header select all
- `data-testid="transaction-row-checkbox"` - Row selection checkbox
- `data-testid="bulk-actions-bar"` - Bulk actions container
- `data-testid="bulk-selected-count"` - Selected count display
- `data-testid="bulk-clear-selection"` - Clear selection button
- `data-testid="filter-chips"` - Active filters container
- `data-testid="filter-chip-{key}"` - Individual filter chips
- `data-testid="command-palette"` - Command palette dialog
- `data-testid="command-palette-input"` - Command palette search input

### Standard Wait Pattern
```typescript
// Wait for API response, then assert UI
await page.waitForResponse(
  (response) => response.url().includes("/api/transactions") && response.status() === 200,
  { timeout: 10000 }
);
const listOrEmpty = page.getByTestId("transactions-list").or(page.getByText("No transactions found"));
await expect(listOrEmpty).toBeVisible({ timeout: 5000 });
```

### Virtualization Considerations
- Only assert on visible rows; the list renders a subset of data
- Use `getByTestId("transaction-row")` to count visible rows
- Scroll the container if testing rows outside the viewport
