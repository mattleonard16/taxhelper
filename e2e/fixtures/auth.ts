import { test as base, Page } from "@playwright/test";

type AuthFixture = {
  authenticatedPage: Page;
};

const devLoginEmail = process.env.DEV_LOGIN_EMAIL || "dev@taxhelper.app";
const devLoginPassword = process.env.DEV_LOGIN_PASSWORD || "devmode123";

export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page }, runFixture) => {
    await page.goto("/auth/signin");
    await page.getByLabel("Email").fill(devLoginEmail);
    await page.getByLabel("Password").fill(devLoginPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL(/\/dashboard/);
    await runFixture(page);
  },
});

export { expect } from "@playwright/test";
