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

## Authentication

### Dev Login (Development Only)
For local development and E2E testing, a "Dev Login" button enables quick authentication without OAuth/email setup.

**Required Environment Variables:**
```env
ENABLE_DEV_LOGIN=true
DEV_LOGIN_EMAIL="dev@taxhelper.app"
DEV_LOGIN_PASSWORD="devmode123"
NEXT_PUBLIC_ENABLE_DEV_LOGIN=true
NEXT_PUBLIC_DEV_LOGIN_EMAIL="dev@taxhelper.app"
NEXT_PUBLIC_DEV_LOGIN_PASSWORD="devmode123"
```

**Behavior:**
- Button only visible when `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true` AND `NODE_ENV !== 'production'`
- Auto-creates dev user in database on first login
- Respects `callbackUrl` for post-login redirects
- Protected against external URL redirects

**Key Files:**
- `src/app/auth/signin/page.tsx` - UI with Dev Login button
- `src/lib/auth.ts` - NextAuth config with dev credentials handling

### Production Auth
- Email/password credentials (bcrypt hashed)
- Optional Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- Optional email magic links (`EMAIL_SERVER`, `EMAIL_FROM`)
- Rate limiting on auth attempts (`@/lib/rate-limit`)

## Export API

`GET /api/export` supports multiple export formats:

| Use Case | Parameters | Response |
|----------|------------|----------|
| Year ZIP | `?year=2024` | ZIP with CSV + receipts |
| Selected IDs | `?ids=id1,id2&format=csv` | CSV file |
| Filtered | `?format=csv&from=YYYY-MM-DD&to=YYYY-MM-DD&type=SALES_TAX` | CSV or JSON |

## Dashboard Balance Card

`src/components/dashboard/balance-card.tsx` displays:
- **Income**: Sum of `INCOME_TAX` transactions
- **Expenses**: Sum of `SALES_TAX` + `OTHER` transactions
- **Balance**: Income - Expenses (green positive, red negative)

## Category Codes

Centralized in `src/lib/categories.ts` - single source of truth for all category-related constants.

**Valid Category Codes:**
| Code | Label | Description |
|------|-------|-------------|
| `MEALS` | Meals & Entertainment | Restaurants, coffee shops, food delivery, bars |
| `TRAVEL` | Travel | Gas, parking, rideshare, hotels, flights, tolls |
| `OFFICE` | Office Supplies | Supplies, electronics, furniture |
| `UTILITIES` | Utilities | Internet, phone, electricity, water |
| `SERVICES` | Professional Services | Consulting, legal, accounting |
| `PROFESSIONAL` | Professional Services | Legacy code (same as SERVICES) |
| `SOFTWARE` | Software & Subscriptions | SaaS, apps, subscriptions |
| `GROCERIES` | Groceries | Supermarkets, food stores |
| `HEALTHCARE` | Healthcare | Pharmacy, medical supplies, doctor visits |
| `OTHER` | Other | Anything else |

**Key Exports from `src/lib/categories.ts`:**
- `CATEGORY_CODES` - Array of all valid codes
- `CATEGORY_LABELS` - Code to label mapping
- `CATEGORY_COLORS` - Code to chart color mapping
- `UI_CATEGORY_OPTIONS` - Array for UI dropdowns (no duplicates)
- `LLM_CATEGORY_PROMPT` - Category prompt for LLM extraction
- `getCategoryLabel(code)` - Helper to get label with fallback
- `getCategoryColor(code)` - Helper to get color with fallback

## TODO
- Type safety: centralize API response types (e.g., `src/types/api.ts`) and normalize money typing.

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
