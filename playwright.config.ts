import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/playwright",
  reporter: [["list"], ["junit", { outputFile: "artifacts/playwright.xml" }]],
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run start",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      APP_ENV: "development",
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_APP_MODE: "test",
      PUBLIC_INDEXING_ENABLED: "false",
      PUBLIC_PRICING_ENABLED: "false",
      AI_ENABLED: "false",
      AI_PROVIDER_MODE: "off",
      CSP_ENFORCE: "true",
    },
  },
});
