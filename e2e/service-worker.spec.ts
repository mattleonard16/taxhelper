import { test, expect } from "@playwright/test";

test("registers the service worker", async ({ page }, testInfo) => {
  await page.goto("/");

  const scopeHandle = await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.scope ?? null;
  }, { timeout: 15000 });

  const scope = await scopeHandle.jsonValue();
  expect(scope).toBeTruthy();

  const baseURL = testInfo.project.use.baseURL as string | undefined;
  if (baseURL) {
    const origin = new URL(baseURL).origin;
    expect(String(scope)).toContain(origin);
  }
});
