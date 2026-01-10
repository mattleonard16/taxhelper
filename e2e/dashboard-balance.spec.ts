import { test, expect } from "@playwright/test";
import { addAuthSession } from "./fixtures/auth-session";

test.describe("Dashboard Balance Card", () => {
  test("displays balance card with income, expenses, and calculated balance", async ({
    page,
  }, testInfo) => {
    await addAuthSession(
      page.context(),
      testInfo.project.use.baseURL as string | undefined
    );

    // Mock /api/summary with byTypeTotals
    await page.route("**/api/summary**", (route) => {
      return route.fulfill({
        json: {
          totalTax: "150.00",
          totalSpent: "1500.00",
          taxShare: 0.1,
          todayTax: "10.00",
          avgDailyTax: "5.00",
          daysTracked: 30,
          byType: {
            SALES_TAX: "100.00",
            INCOME_TAX: "40.00",
            OTHER: "10.00",
          },
          byTypeTotals: {
            SALES_TAX: "500.00",
            INCOME_TAX: "2000.00",
            OTHER: "300.00",
          },
          timeseries: [],
          topMerchants: [],
          transactionCount: 25,
        },
      });
    });

    // Mock /api/transactions
    await page.route("**/api/transactions**", (route) => {
      return route.fulfill({
        json: { transactions: [], pagination: { page: 1, limit: 5, total: 0, pages: 0 } },
      });
    });

    // Mock /api/receipts/stats (required for BalanceCard to render)
    await page.route("**/api/receipts/stats**", (route) => {
      return route.fulfill({
        json: {
          receipts: { total: 10, processed: 8, pending: 1, failed: 1 },
          tax: { totalPaid: "150.00", totalSpent: "1500.00", transactionCount: 25 },
          deductions: { total: "200.00", count: 5 },
          categories: [],
          avgConfidence: 0.85,
        },
      });
    });

    // Mock /api/recurring/generate
    await page.route("**/api/recurring/generate**", (route) => {
      return route.fulfill({ json: { generated: 0 } });
    });

    // Mock /api/settings
    await page.route("**/api/settings**", (route) => {
      return route.fulfill({
        json: {
          name: "E2E User",
          email: "e2e@test.local",
          country: null,
          state: null,
          defaultTaxRate: null,
          currency: "USD",
          timezone: "America/Los_Angeles",
        },
      });
    });

    await page.goto("/dashboard");

    // Wait for dashboard to load
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Wait for Balance Card to render (requires receiptStats to be loaded)
    const balanceCard = page.getByTestId("balance-card");
    await expect(balanceCard).toBeVisible({ timeout: 15000 });

    // Verify calculated values:
    // Income = INCOME_TAX = 2000.00
    // Expenses = SALES_TAX + OTHER = 500 + 300 = 800.00
    // Balance = 2000 - 800 = 1200.00
    await expect(balanceCard.getByText("$1,200.00")).toBeVisible();
    await expect(balanceCard.getByText("$2,000.00")).toBeVisible();
    await expect(balanceCard.getByText("$800.00")).toBeVisible();
  });

  test("displays negative balance in red when expenses exceed income", async ({
    page,
  }, testInfo) => {
    await addAuthSession(
      page.context(),
      testInfo.project.use.baseURL as string | undefined
    );

    await page.route("**/api/summary**", (route) => {
      return route.fulfill({
        json: {
          totalTax: "100.00",
          totalSpent: "3000.00",
          taxShare: 0.033,
          todayTax: "5.00",
          avgDailyTax: "3.33",
          daysTracked: 30,
          byType: {
            SALES_TAX: "80.00",
            INCOME_TAX: "10.00",
            OTHER: "10.00",
          },
          byTypeTotals: {
            SALES_TAX: "1500.00",
            INCOME_TAX: "500.00",
            OTHER: "1000.00",
          },
          timeseries: [],
          topMerchants: [],
          transactionCount: 15,
        },
      });
    });

    await page.route("**/api/transactions**", (route) => {
      return route.fulfill({
        json: { transactions: [], pagination: { page: 1, limit: 5, total: 0, pages: 0 } },
      });
    });

    await page.route("**/api/receipts/stats**", (route) => {
      return route.fulfill({
        json: {
          receipts: { total: 5, processed: 5, pending: 0, failed: 0 },
          tax: { totalPaid: "100.00", totalSpent: "3000.00", transactionCount: 15 },
          deductions: { total: "50.00", count: 2 },
          categories: [],
          avgConfidence: 0.9,
        },
      });
    });

    await page.route("**/api/recurring/generate**", (route) => {
      return route.fulfill({ json: { generated: 0 } });
    });

    await page.route("**/api/settings**", (route) => {
      return route.fulfill({
        json: {
          name: "E2E User",
          email: "e2e@test.local",
          country: null,
          state: null,
          defaultTaxRate: null,
          currency: "USD",
          timezone: "America/Los_Angeles",
        },
      });
    });

    await page.goto("/dashboard");

    // Wait for Balance Card to render
    const balanceCard = page.getByTestId("balance-card");
    await expect(balanceCard).toBeVisible({ timeout: 15000 });

    // Income = 500, Expenses = 1500 + 1000 = 2500, Balance = -2000
    await expect(balanceCard.getByText("-$2,000.00")).toBeVisible();

    // Verify it has the red color class (text-rose-500)
    const balanceElement = balanceCard.locator("p.text-rose-500");
    await expect(balanceElement).toBeVisible();
    await expect(balanceElement).toContainText("-$2,000.00");
  });
});
