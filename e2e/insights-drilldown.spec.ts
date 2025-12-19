import { test, expect } from "@playwright/test";
import { addAuthSession } from "./fixtures/auth-session";
import { mockInsightsRoutes } from "./fixtures/insights-api";

test("insights drill-down shows supporting transactions", async (
  { page },
  testInfo
) => {
  await addAuthSession(
    page.context(),
    testInfo.project.use.baseURL as string | undefined
  );
  await mockInsightsRoutes(page);

  await page.goto("/insights");
  await expect(page.getByText("Caffeine drip")).toBeVisible();

  await page
    .getByRole("button", { name: /show transactions for caffeine drip/i })
    .click();
  await expect(page.getByText("Acme Supplies")).toBeVisible();
});
