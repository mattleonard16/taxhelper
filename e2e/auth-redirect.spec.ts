import { test, expect } from "@playwright/test";

test("redirects unauthenticated users to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/signin/);
  await expect(page.getByText("Welcome back")).toBeVisible();
});
