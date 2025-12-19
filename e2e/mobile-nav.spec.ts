import { test, expect } from "@playwright/test";
import { addAuthSession } from "./fixtures/auth-session";
import { mockInsightsRoutes } from "./fixtures/insights-api";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile nav stays visible without hiding content", async (
  { page },
  testInfo
) => {
  await addAuthSession(
    page.context(),
    testInfo.project.use.baseURL as string | undefined
  );
  await mockInsightsRoutes(page, {
    insights: [],
    initialTransactions: [],
    drilldownTransactions: [],
  });

  await page.goto("/insights");

  const nav = page.getByTestId("mobile-nav");
  await expect(nav).toBeVisible();

  const navBox = await nav.boundingBox();
  const viewport = page.viewportSize();
  if (!navBox || !viewport) {
    throw new Error("Missing layout metrics for mobile nav");
  }

  expect(Math.round(navBox.y + navBox.height)).toBeGreaterThanOrEqual(
    viewport.height - 1
  );

  const mainPadding = await page
    .locator("main")
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(mainPadding).toBeGreaterThanOrEqual(navBox.height - 1);
});
