import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const authSecret = process.env.NEXTAUTH_SECRET ?? "test-secret";

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
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://taxhelper:taxhelper@localhost:5432/taxhelper",
      NEXT_PUBLIC_HAS_GOOGLE_AUTH: "false",
      NEXT_PUBLIC_HAS_EMAIL_AUTH: "false",
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
