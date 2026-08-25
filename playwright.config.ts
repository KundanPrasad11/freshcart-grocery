import { defineConfig } from "@playwright/test";
import { configureTestEnvironment } from "./tests/support/test-environment";

const testEnvironment = configureTestEnvironment();
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  ...(process.env.PLAYWRIGHT_BASE_URL ? {} : { globalTeardown: "./tests/e2e/global-teardown.ts" }),
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --port 3001",
          url: "http://localhost:3001",
          reuseExistingServer: false,
          timeout: 60_000,
          env: {
            ...process.env,
            PLAYWRIGHT_TEST: "1",
            MONGODB_URI: testEnvironment.uri,
            MONGODB_DB: testEnvironment.database,
            AUTH_SECRET: process.env.AUTH_SECRET_TEST ?? "freshcart-test-secret",
            RESEND_API_KEY: "",
            INVOICE_FROM: "",
            INVOICE_TEST_RECIPIENT: "",
          },
        },
      }),
});
