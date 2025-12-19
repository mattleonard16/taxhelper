# TaxHelper

## Project Overview

TaxHelper is a tax awareness and tracking application designed to help users monitor sales and income tax payments. It provides visual insights through charts and detailed summaries.

### Architecture & Tech Stack

*   **Frontend Framework:** Next.js 16 (App Router) with React 19.
*   **Language:** TypeScript.
*   **Styling:** Tailwind CSS 4 with `shadcn/ui` components.
*   **Database:** PostgreSQL (Neon Serverless) managed via Prisma ORM (`@prisma/adapter-neon`).
*   **Authentication:** NextAuth.js (v4) with Google and Email providers.
*   **State/Data Fetching:** Server Components + Server Actions (implied by Next.js 16 App Router patterns).
*   **Visualization:** Recharts for data visualization.
*   **Testing:** Vitest with React Testing Library.

## Building and Running

### Prerequisites

*   Node.js 18+
*   PostgreSQL Database (Neon recommended, or local Postgres)
*   Environment variables set in `.env` (see `README.md` for template)

### Key Commands

| Command | Description |
| :--- | :--- |
| `npm install` | Install project dependencies. |
| `npm run dev` | Start the development server on `http://localhost:3000`. |
| `npm run build` | Create a production build. |
| `npm run start` | Start the production server. |
| `npm run lint` | Run ESLint to check for code quality issues. |
| `npm test` | Run the test suite using Vitest. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run test:coverage`| Run tests and generate a coverage report. |
| `npx prisma migrate dev`| Apply database migrations and generate the Prisma client. |
| `npx prisma studio` | Open a visual editor for the database. |

## Development Conventions

### File Structure

*   `src/app`: Next.js App Router pages and API routes.
    *   `src/app/(app)`: Authenticated application routes (Dashboard, Transactions, Insights, etc.).
    *   `src/app/api`: Backend API endpoints.
*   `src/components`: React components.
    *   `src/components/ui`: Reusable UI components (mostly Shadcn).
    *   `src/components/dashboard`, `src/components/transactions`, `src/components/insights`: Feature-specific components.
*   `src/lib`: Shared utilities, constants, and library configurations (Prisma, Auth).
    *   `src/lib/insights`: Insight generators (Quiet Leaks, Tax Drag, Spikes) with pure functions.
*   `src/hooks`: Custom React hooks.
*   `prisma`: Database schema, migrations, and seed scripts.
*   `src/test`: Test setup and utilities.

### Coding Style

*   **Path Aliases:** Use `@/` to import from the `src` directory.
*   **Typing:** Strict TypeScript usage. Define types/interfaces in `src/types` or colocated with features.
*   **Styling:** Use Tailwind CSS utility classes. Avoid custom CSS files where possible.
*   **Components:** Functional components using Hooks. Place feature-specific components in their respective subdirectories within `src/components`.

### Testing

*   Tests are written using **Vitest** and **React Testing Library**.
*   Test files are colocated with the code they test (e.g., `__tests__` directories) or follow the `*.test.ts/tsx` pattern.
*   Environment is configured for `jsdom`.

### Database

*   Modify `prisma/schema.prisma` for schema changes.
*   Always run `npx prisma migrate dev` after schema modification to update the database and regenerate the client.
