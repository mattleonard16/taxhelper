import { test, expect } from "@playwright/test";
import { addAuthSession } from "./fixtures/auth-session";
import { mockInsightsRoutes } from "./fixtures/insights-api";

test.describe("Insights explainability", () => {
  test("shows Why am I seeing this? button and explanation", async ({
    page,
  }, testInfo) => {
    await addAuthSession(
      page.context(),
      testInfo.project.use.baseURL as string | undefined
    );
    await mockInsightsRoutes(page);

    await page.goto("/insights");
    await expect(page.getByText("Caffeine drip")).toBeVisible();

    // Click "Why am I seeing this?" button
    const whyButton = page.getByRole("button", {
      name: /why am i seeing this/i,
    });
    await expect(whyButton).toBeVisible();
    await whyButton.click();

    // Verify explanation content is shown
    await expect(
      page.getByText(/recurring small purchases at Acme Supplies/i)
    ).toBeVisible();
    
    // Verify thresholds are shown
    await expect(page.getByText(/occurrences/i)).toBeVisible();
    await expect(page.getByText(/cumulative total/i)).toBeVisible();
    
    // Verify suggestion is shown
    await expect(
      page.getByText(/consider whether these frequent purchases/i)
    ).toBeVisible();
  });

  test("can collapse explanation after viewing", async ({
    page,
  }, testInfo) => {
    await addAuthSession(
      page.context(),
      testInfo.project.use.baseURL as string | undefined
    );
    await mockInsightsRoutes(page);

    await page.goto("/insights");
    
    // Expand explanation
    await page.getByRole("button", { name: /why am i seeing this/i }).click();
    await expect(
      page.getByText(/recurring small purchases/i)
    ).toBeVisible();

    // Collapse explanation
    await page.getByRole("button", { name: /hide explanation/i }).click();
    await expect(
      page.getByText(/recurring small purchases/i)
    ).not.toBeVisible();
    
    // Why button should be visible again
    await expect(
      page.getByRole("button", { name: /why am i seeing this/i })
    ).toBeVisible();
  });
});
