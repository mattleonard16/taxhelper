import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Protected Routes", () => {
    test("redirects unauthenticated user to sign in", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/auth\/signin/);
      await expect(page.getByText("Welcome back")).toBeVisible();
    });

    test("preserves callbackUrl in redirect", async ({ page }) => {
      await page.goto("/transactions");
      await expect(page).toHaveURL(/callbackUrl.*transactions/);
    });

    test("redirects from /insights to signin", async ({ page }) => {
      await page.goto("/insights");
      await expect(page).toHaveURL(/\/auth\/signin/);
    });
  });

  test.describe("Dev Login", () => {
    test("shows dev login button in development", async ({ page }) => {
      await page.goto("/auth/signin");
      await expect(page.getByRole("button", { name: "Dev Login" })).toBeVisible();
    });

    test("dev login creates user and redirects to dashboard", async ({ page }) => {
      await page.goto("/auth/signin");
      await page.getByRole("button", { name: "Dev Login" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
      await expect(page.getByText("Dashboard")).toBeVisible();
    });

    test("dev login respects callbackUrl", async ({ page }) => {
      await page.goto("/auth/signin?callbackUrl=/transactions");
      await page.getByRole("button", { name: "Dev Login" }).click();
      await page.waitForURL(/\/transactions/, { timeout: 30000 });
    });
  });

  test.describe("Credentials Login", () => {
    test("shows error on invalid credentials", async ({ page }) => {
      await page.goto("/auth/signin");
      await page.getByLabel("Email").fill("wrong@example.com");
      await page.getByLabel("Password").fill("wrongpassword");
      await page.getByRole("button", { name: "Sign In" }).click();
      await expect(page.getByText("Invalid email or password")).toBeVisible({ timeout: 15000 });
    });

    test("credentials login works after registration", async ({ page }) => {
      // First register
      await page.goto("/auth/signup");
      const email = `test-${Date.now()}@example.com`;
      await page.getByLabel("Name", { exact: false }).fill("Test User");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill("TestPass123!");
      await page.getByLabel("Confirm Password").fill("TestPass123!");
      await page.getByRole("button", { name: "Create Account" }).click();

      // Should redirect to signin with registered notice
      await page.waitForURL(/\/auth\/signin.*registered=true/, { timeout: 30000 });

      // Now login
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill("TestPass123!");
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    });
  });

  test.describe("Sign Out", () => {
    test("sign out redirects to home", async ({ page }) => {
      // First login
      await page.goto("/auth/signin");
      await page.getByRole("button", { name: "Dev Login" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });

      // Sign out via avatar dropdown - look for the dropdown trigger in nav
      await page.getByTestId("user-menu-trigger").click();
      await page.getByText("Sign out").click();
      await page.waitForURL(/\/$/, { timeout: 30000 });

      // Should redirect and show signin again on protected route
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/auth\/signin/);
    });
  });

  test.describe("Callback URL Security", () => {
    test("ignores external callback URLs", async ({ page }) => {
      await page.goto("/auth/signin?callbackUrl=https://evil.com");
      await page.getByRole("button", { name: "Dev Login" }).click();
      // Should go to dashboard, not evil.com
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    });

    test("ignores protocol-relative URLs", async ({ page }) => {
      await page.goto("/auth/signin?callbackUrl=//evil.com");
      await page.getByRole("button", { name: "Dev Login" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    });
  });

  test.describe("Google OAuth", () => {
    test("button hidden when NEXT_PUBLIC_HAS_GOOGLE_AUTH=false", async ({ page }) => {
      await page.goto("/auth/signin");
      await expect(page.getByText("Continue with Google")).not.toBeVisible();
    });
  });
});
