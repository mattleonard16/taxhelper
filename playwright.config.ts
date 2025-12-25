import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const authSecret = process.env.NEXTAUTH_SECRET ?? "test-secret";
const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for Playwright. Set PLAYWRIGHT_DATABASE_URL or DATABASE_URL."
  );
}

process.env.PLAYWRIGHT_BASE_URL = baseURL;
process.env.NEXTAUTH_SECRET = authSecret;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3001",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "development",
      PORT: "3001",
      NEXTAUTH_URL: baseURL,
      NEXTAUTH_SECRET: authSecret,
      DATABASE_URL: databaseUrl,
      NEXT_PUBLIC_HAS_GOOGLE_AUTH: "false",
      NEXT_PUBLIC_HAS_EMAIL_AUTH: "false",
      ENABLE_DEV_LOGIN: "true",
      DEV_LOGIN_EMAIL: "dev@taxhelper.app",
      DEV_LOGIN_PASSWORD: "devmode123",
      NEXT_PUBLIC_ENABLE_DEV_LOGIN: "true",
      NEXT_PUBLIC_DEV_LOGIN_EMAIL: "dev@taxhelper.app",
      NEXT_PUBLIC_DEV_LOGIN_PASSWORD: "devmode123",
      SKIP_AUTH_RATE_LIMIT: "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
