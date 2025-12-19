# Codex Updates (Dec 2025)

This file captures recent work completed in TaxHelper to move testing,
insights caching, and UI polish forward.

## Completed
- E2E coverage via Playwright: auth redirect, insights drill-down, mobile nav,
  and service worker registration.
- Insights persistence: Prisma models `InsightRun` and `Insight`, repository
  layer, cache invalidation on transaction updates, optional TTL via
  `INSIGHT_CACHE_TTL_HOURS`.
- Insights UX: pin/dismiss state, refresh support, micro-animations, improved
  empty states.
- API additions: `/api/insights` refresh support, `/api/insights/:id` state
  updates.
- Search improvements: transaction search builder with pairwise tests.
- CI and test scaffolding: GitHub workflow, Playwright artifacts ignored,
  `matchMedia` test stub.
- Kaizen polish: app/insights/transactions error boundaries, reduced-motion
  MotionConfig, focus-visible rings on nav, virtualized transaction list, and
  new E2E coverage for insights refresh and pin/dismiss.
- Insights API: short private SWR cache headers on GET responses.

## Follow-ups
- Decide on insight cache TTL defaults per environment.
- Add analytics around insight generation latency.
- Extend E2E coverage to include pin/dismiss and refresh behavior.
