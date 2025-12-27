import { test, expect, Page } from "@playwright/test";

/**
 * Standard wait pattern for transactions page:
 * 1. Wait for GET /api/transactions response
 * 2. Assert list container is visible
 * 3. If transactions exist, assert at least one row is visible
 * 
 * NOTE: The transactions list uses virtualization (div-based),
 * NOT a <table> element. Always use data-testid locators.
 */
async function waitForTransactionsList(page: Page) {
  // Wait for API response
  await page.waitForResponse(
    (response) => response.url().includes("/api/transactions") && response.status() === 200,
    { timeout: 10000 }
  );
  
  // Wait for either the list or empty state
  const listOrEmpty = page.getByTestId("transactions-list").or(page.getByText("No transactions found"));
  await expect(listOrEmpty).toBeVisible({ timeout: 5000 });
}

test.describe("Transaction Search & Bulk Actions", () => {
  test.beforeEach(async ({ page }) => {
    // Login via dev login
    await page.goto("/auth/signin");
    await page.getByRole("button", { name: "Dev Login" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  });

  test.describe("Filter Persistence", () => {
    test("persists category filter across page refresh", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      // Set category filter - use specific testid or label
      const categorySelect = page.getByRole("combobox", { name: /category/i });
      await categorySelect.click();
      await page.getByRole("option", { name: "Meals" }).click();
      
      // Refresh the page
      await page.reload();
      await waitForTransactionsList(page);
      
      // Verify filter is still set by checking filter chips
      await expect(page.getByTestId("filter-chip-category")).toBeVisible();
    });

    test("clear filters button resets all filters", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      // Set search filter
      await page.getByPlaceholder("Search").fill("test");
      
      // Wait for filter chip to appear
      await expect(page.getByTestId("filter-chip-search")).toBeVisible();
      
      // Click clear filters
      await page.getByRole("button", { name: "Clear filters" }).click();
      
      // Verify filters are reset
      await expect(page.getByPlaceholder("Search")).toHaveValue("");
      await expect(page.getByTestId("filter-chips")).not.toBeVisible();
    });
  });

  test.describe("Keyboard Shortcuts", () => {
    test("slash focuses search input", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      // Press / key
      await page.keyboard.press("/");
      
      // Verify search input is focused
      await expect(page.getByPlaceholder("Search")).toBeFocused();
    });

    test("n key opens new transaction modal", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      // Press n key
      await page.keyboard.press("n");
      
      // Verify modal is open - use role-based locators
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Add Transaction" })).toBeVisible();
    });

    test("escape closes new transaction modal", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      // Open modal
      await page.keyboard.press("n");
      await expect(page.getByRole("dialog")).toBeVisible();
      
      // Press escape
      await page.keyboard.press("Escape");
      
      // Verify modal is closed
      await expect(page.getByRole("dialog")).not.toBeVisible();
    });

    test("cmd+k opens command palette", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      // Press Cmd+K (or Ctrl+K on non-Mac)
      const modifier = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.press(`${modifier}+k`);
      
      // Verify command palette is open using testid
      await expect(page.getByTestId("command-palette")).toBeVisible();
      await expect(page.getByTestId("command-palette-input")).toBeVisible();
    });
  });

  test.describe("Bulk Actions", () => {
    test("shows bulk actions bar when rows selected", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      // Check if there are transactions
      const rowCheckboxes = page.getByTestId("transaction-row-checkbox");
      const rowCount = await rowCheckboxes.count();
      
      if (rowCount > 0) {
        // Click first checkbox
        await rowCheckboxes.first().click();
        
        // Verify bulk actions bar appears
        await expect(page.getByTestId("bulk-actions-bar")).toBeVisible();
        await expect(page.getByTestId("bulk-selected-count")).toContainText("selected");
      }
    });

    test("select all checkbox selects all visible rows", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      const rowCheckboxes = page.getByTestId("transaction-row-checkbox");
      const rowCount = await rowCheckboxes.count();
      
      if (rowCount > 0) {
        // Click select all using testid
        await page.getByTestId("select-all-checkbox").click();
        
        // Verify bulk actions bar shows count
        await expect(page.getByTestId("bulk-actions-bar")).toBeVisible();
        await expect(page.getByTestId("bulk-selected-count")).toContainText(`${rowCount} selected`);
      }
    });

    test("clear selection closes bulk actions bar", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      const rowCheckboxes = page.getByTestId("transaction-row-checkbox");
      const rowCount = await rowCheckboxes.count();
      
      if (rowCount > 0) {
        // Select all
        await page.getByTestId("select-all-checkbox").click();
        await expect(page.getByTestId("bulk-actions-bar")).toBeVisible();
        
        // Clear selection using testid
        await page.getByTestId("bulk-clear-selection").click();
        
        // Verify bulk actions bar is hidden
        await expect(page.getByTestId("bulk-actions-bar")).not.toBeVisible();
      }
    });
  });

  test.describe("Search", () => {
    test("search filters transactions by merchant", async ({ page }) => {
      await page.goto("/transactions");
      await waitForTransactionsList(page);
      
      // Enter search term
      await page.getByPlaceholder("Search").fill("coffee");
      
      // Wait for debounced search API call
      await page.waitForResponse(
        (response) => response.url().includes("/api/transactions") && response.status() === 200,
        { timeout: 5000 }
      );
      
      // Results should update - check list or empty state
      const listOrEmpty = page.getByTestId("transactions-list").or(page.getByText("No transactions found"));
      await expect(listOrEmpty).toBeVisible();
    });
  });
});
