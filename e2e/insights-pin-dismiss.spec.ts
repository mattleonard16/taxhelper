import { test, expect } from "@playwright/test";
import { addAuthSession } from "./fixtures/auth-session";
import { mockInsightsRoutes } from "./fixtures/insights-api";

test("insights pin and dismiss update badges", async ({ page }, testInfo) => {
  await addAuthSession(
    page.context(),
    testInfo.project.use.baseURL as string | undefined
  );

  const insightId = "insight-quiet-1";
  let currentInsight = {
    id: insightId,
    type: "QUIET_LEAK" as const,
    title: "Caffeine drip",
    summary: "Small recurring charges are adding up.",
    severityScore: 6,
    supportingTransactionIds: ["tx-quiet-1"],
    dismissed: false,
    pinned: false,
  };

  await mockInsightsRoutes(page, {
    insightsHandler: async (route) => {
      const request = route.request();

      if (request.method() === "PATCH") {
        const updates = request.postDataJSON() as {
          pinned?: boolean;
          dismissed?: boolean;
        };
        currentInsight = { ...currentInsight, ...updates };
        return route.fulfill({ json: { insight: currentInsight } });
      }

      return route.fulfill({ json: { insights: [currentInsight] } });
    },
  });

  await page.goto("/insights");
  await expect(page.getByText("Caffeine drip")).toBeVisible();
  await expect(page.getByText("Pinned")).toHaveCount(0);
  await expect(page.getByText("Dismissed")).toHaveCount(0);

  await page.getByRole("button", { name: /pin insight/i }).click();
  await expect(page.getByText("Pinned")).toBeVisible();

  await page.getByRole("button", { name: /unpin insight/i }).click();
  await expect(page.getByText("Pinned")).toHaveCount(0);

  await page.getByRole("button", { name: /dismiss insight/i }).click();
  await expect(page.getByText("Dismissed")).toBeVisible();

  await page.getByRole("button", { name: /restore insight/i }).click();
  await expect(page.getByText("Dismissed")).toHaveCount(0);
});
