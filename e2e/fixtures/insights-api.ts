import type { Page, Route } from "@playwright/test";

type InsightFixture = {
  id?: string;
  type: "QUIET_LEAK" | "TAX_DRAG" | "SPIKE" | "DUPLICATE";
  title: string;
  summary: string;
  severityScore: number;
  supportingTransactionIds: string[];
  dismissed?: boolean;
  pinned?: boolean;
};

type TransactionFixture = {
  id: string;
  date: string;
  type: "SALES_TAX" | "INCOME_TAX" | "OTHER";
  description: string | null;
  merchant: string | null;
  totalAmount: string;
  taxAmount: string;
  currency: string;
};

type UserSettingsFixture = {
  name: string | null;
  email: string | null;
  country: string | null;
  state: string | null;
  defaultTaxRate: string | null;
  currency: string;
  timezone: string;
};

const defaultTransaction: TransactionFixture = {
  id: "tx-quiet-1",
  date: "2024-03-01T00:00:00.000Z",
  type: "OTHER",
  description: "Monthly coffee",
  merchant: "Acme Supplies",
  totalAmount: "12.50",
  taxAmount: "1.25",
  currency: "USD",
};

const defaultInsight: InsightFixture = {
  id: "insight-quiet-1",
  type: "QUIET_LEAK",
  title: "Caffeine drip",
  summary: "Small recurring charges are adding up.",
  severityScore: 6,
  supportingTransactionIds: [defaultTransaction.id],
  dismissed: false,
  pinned: false,
};

const defaultSettings: UserSettingsFixture = {
  name: "E2E User",
  email: "e2e@taxhelper.local",
  country: null,
  state: null,
  defaultTaxRate: null,
  currency: "USD",
  timezone: "America/Los_Angeles",
};

type InsightsRouteOptions = {
  insights?: InsightFixture[];
  initialTransactions?: TransactionFixture[];
  drilldownTransactions?: TransactionFixture[];
  settings?: UserSettingsFixture;
  insightsHandler?: (route: Route) => Promise<void> | void;
};

export const mockInsightsRoutes = async (
  page: Page,
  options: InsightsRouteOptions = {}
) => {
  const insights = options.insights ?? [defaultInsight];
  const initialTransactions = options.initialTransactions ?? [];
  const drilldownTransactions = options.drilldownTransactions ?? [
    defaultTransaction,
  ];
  const settings = options.settings ?? defaultSettings;
  const insightsHandler = options.insightsHandler;

  await page.context().route("**/api/settings**", (route) => {
    if (route.request().method() !== "GET") {
      return route.continue();
    }
    return route.fulfill({ json: settings });
  });

  await page.route("**/api/insights**", (route) => {
    if (insightsHandler) {
      return insightsHandler(route);
    }
    return route.fulfill({ json: { insights } });
  });

  await page.route("**/api/transactions**", (route) => {
    const url = new URL(route.request().url());
    const transactions = url.searchParams.has("ids")
      ? drilldownTransactions
      : initialTransactions;

    return route.fulfill({ json: { transactions } });
  });
};
