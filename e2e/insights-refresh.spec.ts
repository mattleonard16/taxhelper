import { test, expect } from "@playwright/test";
import { addAuthSession } from "./fixtures/auth-session";
import { mockInsightsRoutes } from "./fixtures/insights-api";

test("insights refresh triggers a new fetch", async ({ page }, testInfo) => {
  await addAuthSession(
    page.context(),
    testInfo.project.use.baseURL as string | undefined
  );

  const initialInsight = {
    id: "insight-initial",
    type: "QUIET_LEAK" as const,
    title: "Morning brew",
    summary: "Recurring coffee adds up.",
    severityScore: 4,
    supportingTransactionIds: ["tx-quiet-1"],
  };

  const refreshedInsight = {
    id: "insight-refresh",
    type: "SPIKE" as const,
    title: "Weekend spike",
    summary: "A higher-than-usual purchase appeared.",
    severityScore: 8,
    supportingTransactionIds: ["tx-quiet-1"],
  };

  let refreshSeen = false;

  await mockInsightsRoutes(page, {
    insightsHandler: (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "GET" && url.searchParams.get("refresh") === "1") {
        refreshSeen = true;
        return route.fulfill({ json: { insights: [refreshedInsight] } });
      }

      return route.fulfill({ json: { insights: [initialInsight] } });
    },
  });

  await page.goto("/insights");
  await expect(page.getByText("Morning brew")).toBeVisible();

  await page.getByRole("button", { name: /refresh/i }).click();

  await expect.poll(() => refreshSeen).toBe(true);
  await expect(page.getByText("Weekend spike")).toBeVisible();
  await expect(page.getByText("Morning brew")).toHaveCount(0);
});
