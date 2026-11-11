import { defineConfig, devices } from "@playwright/test";

// Each worktree/agent should use its own port: PW_PORT=5181 pnpm test:e2e
const PORT = Number(process.env.PW_PORT || 5180);

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // the dev build registers the PWA service worker; its fetches would skip
    // page.route mocking, so keep it out of tests
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    // phone: touch, mobile viewport (412x839), Chromium
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm exec vite dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
