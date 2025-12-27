import { test, expect } from "@playwright/test";

test.describe("Receipts Inbox", () => {
  test.beforeEach(async ({ page }) => {
    // Login via dev login
    await page.goto("/auth/signin");
    await page.getByRole("button", { name: "Dev Login" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  });

  test("navigates to receipts page from nav", async ({ page }) => {
    await page.getByRole("link", { name: "Receipts" }).click();
    await page.waitForURL(/\/receipts/);
    await expect(page.getByText("Receipt Inbox")).toBeVisible();
    await expect(page.getByText("Review and confirm scanned receipts")).toBeVisible();
  });

  test("shows empty state when no receipts", async ({ page }) => {
    await page.goto("/receipts");
    await expect(page.getByText("No receipts found")).toBeVisible();
    await expect(page.getByText("Upload receipts from the dashboard")).toBeVisible();
  });

  test("has status filter dropdown", async ({ page }) => {
    await page.goto("/receipts");
    await expect(page.getByRole("combobox")).toBeVisible();
    await page.getByRole("combobox").click();
    await expect(page.getByRole("option", { name: "All Statuses" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Needs Review" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Ready to Confirm" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Failed" })).toBeVisible();
  });

  test("has refresh button", async ({ page }) => {
    await page.goto("/receipts");
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });
});
